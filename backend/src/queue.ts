import dotenv from "dotenv";
import { Queue } from "bullmq";

dotenv.config();

export const emailQueue = new Queue("emailQueue", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null,
  },
});

console.log("BullMQ queue connected to Redis ✅");