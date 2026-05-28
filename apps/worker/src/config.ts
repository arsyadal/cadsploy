const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const config = {
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  encryptionKey: required("ENCRYPTION_KEY", "dev-encryption-key-change-before-production-32"),
  workdir: required("CADSPLOY_WORKDIR", ".cadsploy/workdir"),
  dockerNetwork: required("CADSPLOY_DOCKER_NETWORK", "cadsploy-net"),
  defaultMemory: required("CADSPLOY_DEFAULT_MEMORY", "512m"),
  defaultCpus: required("CADSPLOY_DEFAULT_CPUS", "0.5"),
  caddyfile: required("CADSPLOY_CADDYFILE", "./infra/Caddyfile.generated"),
  caddyReloadCommand: process.env.CADSPLOY_CADDY_RELOAD_COMMAND ?? "",
};
