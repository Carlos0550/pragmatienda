import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { env } from "../config/env";

extendZodWithOpenApi(z);

const serverUrl = `http://localhost:${env.PORT}/api`;

export const openApiRegistry = new OpenAPIRegistry();

export const getSwaggerSpec = () => {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Cinnamon API",
      version: "1.0.0",
      description: "Backend base para tienda online"
    },
    servers: [{ url: serverUrl }]
  });
};
