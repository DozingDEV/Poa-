import { createClient } from "redis";
import { RedisStore } from "rate-limit-redis";
import { config } from "./config.js";

export const redisClient = config.REDIS_URL
  ? createClient({ url: config.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on("error", (error) => {
    // Avoid printing connection strings or credentials from the error object.
    console.error("Redis connection error:", error?.name || "RedisError");
  });
}

export const redisReady = redisClient ? redisClient.connect() : Promise.resolve();

export function createRateLimitStore(prefix) {
  if (!redisClient) return undefined; // Local development only; production requires Redis.
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redisClient.sendCommand(args)
  });
}
