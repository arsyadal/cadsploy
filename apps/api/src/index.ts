import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { config, isProduction } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { repoRoutes } from "./routes/repos.js";
import { runtimeRoutes } from "./routes/runtime.js";
import { startScheduler } from "./scheduler.js";

const app = Fastify({ logger: true });

await app.register(sensible);
await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: false,
});
await app.register(cors, {
  origin: config.publicAppUrl,
  credentials: true,
});
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute",
});

app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: "Validation failed", issues: error.flatten() });
  }

  const statusCode = error.statusCode ?? 500;
  request.log.error({ error }, "request failed");
  return reply.status(statusCode).send({
    error: statusCode >= 500 && isProduction ? "Internal server error" : error.message,
  });
});

app.get("/health", async () => ({ ok: true, service: "cadsploy-api" }));

await app.register(authRoutes);
await app.register(repoRoutes);
await app.register(projectRoutes);
await app.register(runtimeRoutes);

await app.listen({ port: config.port, host: "0.0.0.0" });
startScheduler();
