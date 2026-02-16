import { app } from "./app";
import { connectRedis, disconnectRedis } from "./cache/redis";
import "./config/dayjs";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { disconnectPrisma, prisma } from "./db/prisma";
import { ensureDefaultBuckets } from "./storage/minio";

const bootstrap = async () => {
  try {
    logger.info("Conectando a la base de datos...");
    await prisma.$connect();
    logger.info("Conectando a Redis...");
    await connectRedis();
    logger.info("Asegurando buckets de MinIO...");
    await ensureDefaultBuckets();

    const server = app.listen(env.PORT, () => {
      logger.info(`API lista en http://localhost:${env.PORT}`);
    });

    const shutdown = async () => {
      logger.info("Cerrando servidor...");
      server.close(async () => {
        await disconnectRedis();
        await disconnectPrisma();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    if (err instanceof Error) {
      logger.error("Fallo al iniciar el servidor", {
        message: err.message,
        stack: err.stack
      });
    } else {
      logger.error("Fallo al iniciar el servidor", { err });
    }
    process.exit(1);
  }
};

void bootstrap();
