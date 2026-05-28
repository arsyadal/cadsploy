import { Worker, type ConnectionOptions } from "bullmq";
import { config } from "./config.js";
import { deploy } from "./deploy.js";

type DeployJob = {
  deploymentId: string;
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

const worker = new Worker<DeployJob, void, "deploy">(
  "deployments",
  async (job) => {
    await deploy(job.data.deploymentId);
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
