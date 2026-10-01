import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

import { pool } from "./db";
import { emailQueue } from "./queue";

import {
  createEmailIndex,
  indexEmail,
  elasticClient,
} from "./elasticsearch";

import { setSlackWebhookUrl } from "./slack";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ==================================================
// BULL BOARD
// ==================================================

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use(
  "/admin/queues",
  serverAdapter.getRouter()
);

// ==================================================
// HOME / HEALTH CHECK
// ==================================================

app.get("/", (_req, res) => {
  res.json({
    message:
      "ReachInbox Email Scheduler API is running 🚀",
  });
});

// ==================================================
// SLACK OAUTH - INSTALL
// ==================================================

let slackOAuthState = "";

app.get(
  "/auth/slack/install",
  (_req, res) => {
    try {
      const clientId =
        process.env.SLACK_CLIENT_ID;

      const redirectUri =
        process.env.SLACK_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return res.status(500).send(
          "Slack OAuth configuration is missing."
        );
      }

      // Generate OAuth state
      slackOAuthState = crypto
        .randomBytes(16)
        .toString("hex");

      const params =
        new URLSearchParams({
          client_id: clientId,
          scope: "incoming-webhook",
          redirect_uri: redirectUri,
          state: slackOAuthState,
        });

      const slackAuthorizationUrl =
        `https://slack.com/oauth/v2/authorize?${params.toString()}`;

      console.log(
        "Redirecting to Slack OAuth..."
      );

      res.redirect(
        slackAuthorizationUrl
      );
    } catch (error) {
      console.error(
        "Slack install error:",
        error
      );

      res.status(500).send(
        "Failed to start Slack OAuth."
      );
    }
  }
);

// ==================================================
// SLACK OAUTH - CALLBACK
// ==================================================

app.get(
  "/auth/slack/callback",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
      } = req.query;

      // ------------------------------------------------
      // Slack returned an error
      // ------------------------------------------------

      if (error) {
        return res.status(400).send(
          `Slack authorization failed: ${error}`
        );
      }

      // ------------------------------------------------
      // Validate state
      // ------------------------------------------------

      if (
        typeof state !== "string" ||
        state !== slackOAuthState
      ) {
        return res.status(400).send(
          "Invalid Slack OAuth state."
        );
      }

      // ------------------------------------------------
      // Validate authorization code
      // ------------------------------------------------

      if (typeof code !== "string") {
        return res.status(400).send(
          "Slack authorization code is missing."
        );
      }

      // ------------------------------------------------
      // Read OAuth credentials
      // ------------------------------------------------

      const clientId =
        process.env.SLACK_CLIENT_ID;

      const clientSecret =
        process.env.SLACK_CLIENT_SECRET;

      const redirectUri =
        process.env.SLACK_REDIRECT_URI;

      if (
        !clientId ||
        !clientSecret ||
        !redirectUri
      ) {
        return res.status(500).send(
          "Slack OAuth configuration is missing."
        );
      }

      // ------------------------------------------------
      // Create Basic Auth header
      // ------------------------------------------------

      const basicAuth = Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64");

      // ------------------------------------------------
      // Exchange authorization code
      // ------------------------------------------------

      const params =
        new URLSearchParams();

      params.append("code", code);

      params.append(
        "redirect_uri",
        redirectUri
      );

      const response =
        await fetch(
          "https://slack.com/api/oauth.v2.access",
          {
            method: "POST",

            headers: {
              Authorization:
                `Basic ${basicAuth}`,

              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body: params.toString(),
          }
        );

      const data =
        await response.json();

      // ------------------------------------------------
      // Check Slack response
      // ------------------------------------------------

      if (!data.ok) {
        console.error(
          "Slack OAuth error:",
          data
        );

        return res.status(400).send(
          `Slack OAuth failed: ${
            data.error ||
            "Unknown error"
          }`
        );
      }

      // ------------------------------------------------
      // Get webhook URL
      // ------------------------------------------------

      const webhookUrl =
        data.incoming_webhook?.url;

      if (webhookUrl) {
        // Save webhook URL in PostgreSQL
        await setSlackWebhookUrl(
          webhookUrl
        );

        console.log(
          "Slack webhook saved from OAuth ✅"
        );

        console.log(
          `Slack channel: ${
            data.incoming_webhook.channel ||
            "Unknown"
          }`
        );
      } else {
        console.log(
          "OAuth succeeded, but no incoming webhook was returned."
        );
      }

      // ------------------------------------------------
      // Clear state
      // ------------------------------------------------

      slackOAuthState = "";

      // ------------------------------------------------
      // Success page
      // ------------------------------------------------

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Slack Connected</title>
          </head>

          <body
            style="
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
            "
          >

            <h1>
              Slack Connected ✅
            </h1>

            <p>
              ReachInbox has been
              successfully connected
              to Slack.
            </p>

            <p>
              You can close this window
              and return to ReachInbox.
            </p>

          </body>
        </html>
      `);
    } catch (error) {
      console.error(
        "Slack OAuth callback failed:",
        error
      );

      res.status(500).send(
        "Slack OAuth callback failed."
      );
    }
  }
);

// ==================================================
// SCHEDULE EMAIL
// ==================================================

app.post(
  "/api/schedule",
  async (req, res) => {
    try {
      const {
        recipient,
        subject,
        body,
        scheduledAt,
      } = req.body;

      // ------------------------------------------------
      // VALIDATION
      // ------------------------------------------------

      if (
        !recipient ||
        !subject ||
        !body ||
        !scheduledAt
      ) {
        return res.status(400).json({
          message:
            "recipient, subject, body and scheduledAt are required",
        });
      }

      // Basic email validation
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(recipient)) {
        return res.status(400).json({
          message:
            "Invalid recipient email address",
        });
      }

      // ------------------------------------------------
      // CONVERT SCHEDULED TIME
      // ------------------------------------------------

      const scheduledDate =
        new Date(scheduledAt);

      if (
        isNaN(
          scheduledDate.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid scheduledAt",
        });
      }

      // ------------------------------------------------
      // SAVE TO POSTGRESQL
      // ------------------------------------------------

      const result =
        await pool.query(
          `
          INSERT INTO emails (
            recipient,
            subject,
            body,
            scheduled_at
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
          `,
          [
            recipient,
            subject,
            body,
            scheduledDate,
          ]
        );

      const emailId =
        result.rows[0].id;

      console.log(
        `📥 Email ${emailId} saved to PostgreSQL ✅`
      );

      // ------------------------------------------------
      // INDEX IN ELASTICSEARCH
      // ------------------------------------------------

      try {
        await indexEmail({
          id: emailId,
          recipient,
          subject,
          body,
          scheduledAt:
            scheduledDate,
          status: "scheduled",
        });

        console.log(
          `📊 Email ${emailId} indexed in Elasticsearch ✅`
        );
      } catch (error) {
        // Elasticsearch should not stop
        // the actual email scheduling.
        console.error(
          `⚠️ Elasticsearch indexing failed for email ${emailId}:`,
          error
        );
      }

      // ------------------------------------------------
      // CALCULATE BULLMQ DELAY
      // ------------------------------------------------

      const delay =
        Math.max(
          0,
          scheduledDate.getTime() -
            Date.now()
        );

      // ------------------------------------------------
      // ADD JOB TO BULLMQ
      // ------------------------------------------------

      try {
        await emailQueue.add(
          "send-email",
          {
            emailId,
            recipient,
            subject,
            body,
          },
          {
            jobId:
              `email-${emailId}`,

            delay,
          }
        );

        console.log(
          `📦 Email ${emailId} added to BullMQ ✅`
        );
      } catch (queueError) {
        console.error(
          `❌ BullMQ failed for email ${emailId}:`,
          queueError
        );

        // Mark email as failed
        await pool.query(
          `
          UPDATE emails
          SET status = 'failed'
          WHERE id = $1
          `,
          [emailId]
        );

        return res.status(500).json({
          message:
            "Email was saved but could not be added to the queue",
          emailId,
        });
      }

      // ------------------------------------------------
      // SUCCESS RESPONSE
      // ------------------------------------------------

      res.status(201).json({
        message:
          "Email scheduled successfully ✅",
        emailId,
      });
    } catch (error) {
      console.error(
        "Schedule error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to schedule email",
      });
    }
  }
);

// ==================================================
// SEARCH EMAILS USING ELASTICSEARCH
// ==================================================

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const q =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      if (!q) {
        return res.status(400).json({
          message:
            "Search query is required",
        });
      }

      const result =
        await elasticClient.search({
          index: "emails",

          query: {
            multi_match: {
              query: q,

              fields: [
                "recipient",
                "subject",
                "body",
              ],
            },
          },
        });

      const emails =
        result.hits.hits.map(
          (hit) => hit._source
        );

      res.json(emails);
    } catch (error) {
      console.error(
        "Elasticsearch search failed:",
        error
      );

      res.status(500).json({
        message:
          "Failed to search emails",
      });
    }
  }
);

// ==================================================
// GET EMAILS
// ==================================================

app.get(
  "/api/emails",
  async (req, res) => {
    try {
      const status =
        req.query.status;

      let query = `
        SELECT
          id,
          recipient,
          subject,
          body,
          scheduled_at,
          sent_at,
          status
        FROM emails
      `;

      const values: string[] = [];

      // ------------------------------------------------
      // FILTER BY STATUS
      // ------------------------------------------------

      if (
        typeof status === "string" &&
        [
          "scheduled",
          "sent",
          "failed",
        ].includes(status)
      ) {
        query +=
          ` WHERE status = $1`;

        values.push(status);
      }

      // ------------------------------------------------
      // SORT
      // ------------------------------------------------

      query += `
        ORDER BY scheduled_at ASC
      `;

      // ------------------------------------------------
      // EXECUTE QUERY
      // ------------------------------------------------

      const result =
        await pool.query(
          query,
          values
        );

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "Failed to fetch emails:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch emails",
      });
    }
  }
);

// ==================================================
// START SERVER
// ==================================================

const PORT =
  process.env.PORT || 4000;

async function startServer() {
  try {
    // ------------------------------------------------
    // CREATE ELASTICSEARCH INDEX
    // ------------------------------------------------

    await createEmailIndex();

    // ------------------------------------------------
    // START EXPRESS SERVER
    // ------------------------------------------------

    app.listen(
      PORT,
      () => {
        console.log(
          `Backend running on http://localhost:${PORT}`
        );

        console.log(
          `Bull Board: http://localhost:${PORT}/admin/queues`
        );

        console.log(
          `Slack OAuth: http://localhost:${PORT}/auth/slack/install`
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start backend:",
      error
    );
  }
}

startServer();