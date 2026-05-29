import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../");

const resolvePath = (p: string) => {
  if (isAbsolute(p)) return p;
  return resolve(repoRoot, p);
};

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const config = {
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  encryptionKey: required("ENCRYPTION_KEY", "dev-encryption-key-change-before-production-32"),
  workdir: resolvePath(required("CADSPLOY_WORKDIR", ".cadsploy/workdir")),
  dockerNetwork: required("CADSPLOY_DOCKER_NETWORK", "cadsploy-net"),
  defaultMemory: required("CADSPLOY_DEFAULT_MEMORY", "512m"),
  defaultCpus: required("CADSPLOY_DEFAULT_CPUS", "0.5"),
  caddyfile: resolvePath(required("CADSPLOY_CADDYFILE", "./infra/Caddyfile.generated")),
  caddyReloadCommand: process.env.CADSPLOY_CADDY_RELOAD_COMMAND ?? "",
  backupsDir: resolvePath(required("CADSPLOY_BACKUPS_DIR", "backups")),
};

