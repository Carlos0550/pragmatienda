import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env";
import { logger } from "../config/logger";

let client: RedisClientType | null = null;

export const getRedisClient = () => {
  if (!client) {
    client = createClient({ url: env.REDIS_URL });
    client.on("error", (err) => {
      logger.error("Redis error", { err });
    });
  }

  return client;
};

export const connectRedis = async () => {
  try {
    const redis = getRedisClient();
  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
  } catch (error) {
    const err = error as Error;
    logger.error("Error al conectar a Redis", err.message);
    throw err;
  }
};

export const disconnectRedis = async () => {
  if (client && client.isOpen) {
    await client.quit();
  }
};
