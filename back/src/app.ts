import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger, requestLogger } from "./config/logger";
import { getSwaggerSpec } from "./docs/swagger";
import { apiRouter } from "./routes";

const app = express();

const corsOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(requestLogger);

app.use("/api", apiRouter);

const swaggerSpec = getSwaggerSpec();
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", { err });
  res.status(500).json({ message: "Internal server error", err: err.message });
  void next;
});

export { app };
