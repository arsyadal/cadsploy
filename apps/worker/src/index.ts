import { Worker, type ConnectionOptions } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { deploy } from "./deploy.js";
import { regenerateCaddyfile } from "./proxy.js";
import { deployDatabase, deleteDatabase } from "./database.js";

type DeployJob = {
  deploymentId?: string;
  databaseId?: string;
};

function redisOptions(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
    maxRetriesPerRequest: null,
  };
}

const prisma = new PrismaClient();

const worker = new Worker<DeployJob, void, string>(
  "deployments",
  async (job) => {
    if (job.name === "deploy") {
      if (!job.data.deploymentId) throw new Error("Missing deploymentId for deploy job");
      await deploy(job.data.deploymentId);
    } else if (job.name === "regenerate-caddy") {
      await regenerateCaddyfile(prisma);
    } else if (job.name === "deploy-database") {
      if (!job.data.databaseId) throw new Error("Missing databaseId for deploy-database job");
      await deployDatabase(job.data.databaseId);
    } else if (job.name === "delete-database") {
      if (!job.data.databaseId) throw new Error("Missing databaseId for delete-database job");
      await deleteDatabase(job.data.databaseId);
    }
  },
  {
    connection: redisOptions(config.redisUrl),
    concurrency: Number(process.env.CADSPLOY_WORKER_CONCURRENCY ?? 1),
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] deployment job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] deployment job failed: ${job?.id}`, error);
});

console.log("Cadsploy worker started");
