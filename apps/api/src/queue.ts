import { Queue, type ConnectionOptions } from "bullmq";
import { config } from "./config.js";

export type DeployJob = {
  deploymentId: string;
};

export function redisOptions(url: string): ConnectionOptions {
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

export const deployQueue = new Queue<DeployJob, void, "deploy">("deployments", {
  connection: redisOptions(config.redisUrl),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});
