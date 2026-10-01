import dotenv from "dotenv";
import { Queue } from "bullmq";

dotenv.config();

const redisUrl =
  process.env.REDIS_URL ||
  "redis://127.0.0.1:6379";

const parsedRedisUrl = new URL(redisUrl);

const redisConnection = {
  host: parsedRedisUrl.hostname,
  port:
    Number(parsedRedisUrl.port) || 6379,

  username:
    parsedRedisUrl.username
      ? decodeURIComponent(
          parsedRedisUrl.username
        )
      : undefined,

  password:
    parsedRedisUrl.password
      ? decodeURIComponent(
          parsedRedisUrl.password
        )
      : undefined,

  maxRetriesPerRequest: null,

  ...(parsedRedisUrl.protocol === "rediss:"
    ? {
        tls: {},
      }
    : {}),
};

export const emailQueue =
  new Queue("emailQueue", {
    connection: redisConnection,
  });

console.log(
  "BullMQ queue connected to Redis ✅"
);