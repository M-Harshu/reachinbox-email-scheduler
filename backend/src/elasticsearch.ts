import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

export const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

const EMAIL_INDEX = "emails";

export async function createEmailIndex() {
  const exists = await elasticClient.indices.exists({
    index: EMAIL_INDEX,
  });

  if (!exists) {
    await elasticClient.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: "integer" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
          status: { type: "keyword" },
        },
      },
    });

    console.log("Elasticsearch emails index created ✅");
  } else {
    console.log("Elasticsearch emails index already exists ✅");
  }
}

export async function indexEmail(email: {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  status: string;
}) {
  await elasticClient.index({
    index: EMAIL_INDEX,
    id: String(email.id),
    document: {
      id: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt ?? null,
      status: email.status,
    },
  });

  console.log(`📊 Email ${email.id} indexed in Elasticsearch ✅`);
}