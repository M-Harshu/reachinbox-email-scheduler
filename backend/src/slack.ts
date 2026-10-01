import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config();

const SLACK_WEBHOOK_KEY = "slack_webhook_url";

export async function setSlackWebhookUrl(url: string) {
  await pool.query(
    `
    INSERT INTO app_settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
    `,
    [SLACK_WEBHOOK_KEY, url]
  );

  console.log("Slack webhook saved to database ✅");
}

export async function getSlackWebhookUrl() {
  const result = await pool.query(
    `
    SELECT value
    FROM app_settings
    WHERE key = $1
    `,
    [SLACK_WEBHOOK_KEY]
  );

  if (result.rows.length > 0) {
    return result.rows[0].value;
  }

  return process.env.SLACK_WEBHOOK_URL || "";
}

export async function sendSlackNotification(
  message: string
) {
  const slackWebhookUrl =
    await getSlackWebhookUrl();

  if (!slackWebhookUrl) {
    console.log(
      "Slack webhook URL not configured. Skipping notification."
    );
    return;
  }

  try {
    const response = await fetch(
      slackWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: message,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Slack returned ${response.status}: ${await response.text()}`
      );
    }

    console.log(
      "📣 Slack notification sent ✅"
    );
  } catch (error) {
    console.error(
      "❌ Slack notification failed:",
      error
    );
  }
}