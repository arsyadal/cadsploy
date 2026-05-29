import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../");

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgresql://cadsploy:cadsploy@localhost:5432/cadsploy?schema=public"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  encryptionKey: required("ENCRYPTION_KEY", "dev-encryption-key-change-before-production-32"),
  sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-before-production"),
  publicAppUrl: required("PUBLIC_APP_URL", "http://localhost:3000"),
  apiUrl: required("API_URL", "http://localhost:4000"),
  baseDomain: required("BASE_DOMAIN", "localhost"),
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  githubCallbackUrl: required("GITHUB_CALLBACK_URL", "http://localhost:4000/auth/github/callback"),
  backupsDir: resolve(repoRoot, "backups"),
  volumesDir: resolve(repoRoot, "volumes"),
};

export const isProduction = config.nodeEnv === "production";
