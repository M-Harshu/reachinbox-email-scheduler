import dotenv from "dotenv";
import { Worker } from "bullmq";
import nodemailer from "nodemailer";

import { pool } from "./db";
import { elasticClient } from "./elasticsearch";
import { sendSlackNotification } from "./slack";

dotenv.config();

async function startWorker() {
  // --------------------------------------------------
  // CREATE ETHEREAL TEST ACCOUNT
  // --------------------------------------------------

  const testAccount =
    await nodemailer.createTestAccount();

  const transporter =
    nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

  // --------------------------------------------------
  // CREATE WORKER
  // --------------------------------------------------

  const worker = new Worker(
    "emailQueue",

    async (job) => {
      console.log(
        `📩 Processing job ${job.id}`
      );

      const { emailId } =
        job.data;

      try {
        // ------------------------------------------------
        // GET EMAIL FROM POSTGRESQL
        // ------------------------------------------------

        const result =
          await pool.query(
            "SELECT * FROM emails WHERE id = $1",
            [emailId]
          );

        if (
          result.rows.length === 0
        ) {
          throw new Error(
            `Email ${emailId} not found`
          );
        }

        const email =
          result.rows[0];

        // ------------------------------------------------
        // AVOID DUPLICATE SEND
        // ------------------------------------------------

        if (
          email.status === "sent"
        ) {
          console.log(
            `Email ${emailId} already sent. Skipping.`
          );

          return;
        }

        // ------------------------------------------------
        // SEND EMAIL
        // ------------------------------------------------

        const info =
          await transporter.sendMail({
            from:
              "ReachInbox MVP <no-reply@reachinbox.local>",

            to: email.recipient,

            subject:
              email.subject,

            text:
              email.body,
          });

        // ------------------------------------------------
        // UPDATE POSTGRESQL
        // ------------------------------------------------

        await pool.query(
          `
          UPDATE emails
          SET status = 'sent',
              sent_at = NOW()
          WHERE id = $1
          `,
          [emailId]
        );

        console.log(
          `✅ Email ${emailId} sent successfully`
        );

        // ------------------------------------------------
        // ETHEREAL PREVIEW
        // ------------------------------------------------

        const previewUrl =
          nodemailer.getTestMessageUrl(
            info
          );

        console.log(
          `🔗 Preview: ${previewUrl}`
        );

        // ------------------------------------------------
        // UPDATE ELASTICSEARCH
        // ------------------------------------------------

        try {
          await elasticClient.update({
            index: "emails",
            id: String(emailId),

            doc: {
              status: "sent",
              sentAt: new Date(),
            },
          });

          console.log(
            `📊 Elasticsearch updated for email ${emailId} ✅`
          );
        } catch (error) {
          // Email was already successfully sent.
          // Elasticsearch failure should not
          // cause the email job to fail.

          console.error(
            `⚠️ Elasticsearch update failed for email ${emailId}:`,
            error
          );
        }

        // ------------------------------------------------
        // SEND SLACK NOTIFICATION
        // ------------------------------------------------

        await sendSlackNotification(
          `📧 ReachInbox Email Sent

Recipient: ${email.recipient}
Subject: ${email.subject}
Status: Sent ✅
Email ID: ${emailId}`
        );
      } catch (error) {
        console.error(
          `❌ Email ${emailId} processing failed:`,
          error
        );

        // ------------------------------------------------
        // MARK EMAIL AS FAILED
        // ------------------------------------------------

        try {
          await pool.query(
            `
            UPDATE emails
            SET status = 'failed'
            WHERE id = $1
            AND status <> 'sent'
            `,
            [emailId]
          );

          console.log(
            `⚠️ Email ${emailId} marked as failed`
          );
        } catch (dbError) {
          console.error(
            `❌ Failed to update email ${emailId} status:`,
            dbError
          );
        }

        // Re-throw so BullMQ knows
        // the job failed.
        throw error;
      }
    },

    {
      connection: {
        host: "127.0.0.1",
        port: 6379,
        maxRetriesPerRequest: null,
      },

      concurrency: 3,
    }
  );

  // --------------------------------------------------
  // WORKER READY
  // --------------------------------------------------

  worker.on(
    "ready",
    () => {
      console.log(
        "🚀 Worker connected to Redis and ready"
      );
    }
  );

  // --------------------------------------------------
  // JOB COMPLETED
  // --------------------------------------------------

  worker.on(
    "completed",
    (job) => {
      console.log(
        `✅ Job ${job.id} completed`
      );
    }
  );

  // --------------------------------------------------
  // JOB FAILED
  // --------------------------------------------------

  worker.on(
    "failed",
    (job, error) => {
      console.error(
        `❌ Job ${job?.id} failed:`,
        error.message
      );
    }
  );

  // --------------------------------------------------
  // WORKER ERROR
  // --------------------------------------------------

  worker.on(
    "error",
    (error) => {
      console.error(
        "❌ Worker error:",
        error
      );
    }
  );

  console.log(
    "Email worker starting..."
  );
}

// --------------------------------------------------
// START WORKER
// --------------------------------------------------

startWorker().catch(
  (error) => {
    console.error(
      "❌ Worker failed to start:",
      error
    );
  }
);