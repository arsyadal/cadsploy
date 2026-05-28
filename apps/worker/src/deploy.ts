import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient, type EnvScope, type LogStream } from "@prisma/client";
import { config } from "./config.js";
import { decryptText } from "./crypto.js";
import { runCommand } from "./process.js";
import { regenerateCaddyfile } from "./proxy.js";

const prisma = new PrismaClient();

async function addLog(deploymentId: string, line: string, stream: LogStream = "stdout") {
  const safeLine = line.length > 4000 ? `${line.slice(0, 4000)}…` : line;
  await prisma.buildLog.create({ data: { deploymentId, line: safeLine, stream } });
}

function scopeAllows(scope: EnvScope, target: "build" | "runtime") {
  return scope === "both" || scope === target;
}

async function ensureDockerNetwork() {
  try {
    await runCommand("docker", ["network", "inspect", config.dockerNetwork], { timeoutMs: 10_000 });
  } catch {
    await runCommand("docker", ["network", "create", config.dockerNetwork], { timeoutMs: 20_000 });
  }
}

export async function deploy(deploymentId: string) {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      project: {
        include: {
          user: true,
          envVars: true,
        },
      },
    },
  });

  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

  const project = deployment.project;
  const containerName = `cadsploy-${project.slug}`;
  const workdir = join(process.cwd(), config.workdir, deployment.id);
  const repoDir = join(workdir, "repo");

  const log = (line: string, stream: LogStream = "stdout") => addLog(deployment.id, line, stream);

  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { status: "building", startedAt: new Date(), containerName },
  });

  try {
    await mkdir(workdir, { recursive: true });
    await log(`Starting deployment for ${project.repoOwner}/${project.repoName}#${project.branch}`);

    const githubToken = decryptText(project.user.githubAccessTokenEncrypted);
    const repoHttpsUrl = `https://github.com/${project.repoOwner}/${project.repoName}.git`;

    await log("Cloning repository");
    await runCommand(
      "git",
      ["-c", `http.extraHeader=Authorization: Bearer ${githubToken}`, "clone", "--depth", "1", "--branch", project.branch, repoHttpsUrl, repoDir],
      { onLog: log, timeoutMs: 5 * 60_000 },
    );

    await runCommand("git", ["rev-parse", "HEAD"], {
      cwd: repoDir,
      onLog: async (line) => {
        await prisma.deployment.update({ where: { id: deployment.id }, data: { commitSha: line.trim() } });
        await log(`Commit ${line.trim()}`);
      },
      timeoutMs: 30_000,
    });

    const buildEnv = Object.fromEntries(
      project.envVars
        .filter((item) => scopeAllows(item.scope, "build"))
        .map((item) => [item.key, decryptText(item.valueEncrypted)]),
    );

    if (project.buildMethod === "dockerfile") {
      await log(`Building Docker image ${deployment.imageTag}`);
      await runCommand("docker", ["build", "-t", deployment.imageTag, "."], {
        cwd: repoDir,
        env: buildEnv,
        onLog: log,
        timeoutMs: 30 * 60_000,
      });
    } else {
      await log(`Building Nixpacks image ${deployment.imageTag}`);
      await runCommand("nixpacks", ["build", ".", "-n", deployment.imageTag], {
        cwd: repoDir,
        env: buildEnv,
        onLog: log,
        timeoutMs: 30 * 60_000,
      });
    }

    await ensureDockerNetwork();

    const runtimeEnv = project.envVars
      .filter((item) => scopeAllows(item.scope, "runtime"))
      .flatMap((item) => ["-e", `${item.key}=${decryptText(item.valueEncrypted)}`]);

    await log("Replacing runtime container");
    await runCommand("docker", ["rm", "-f", containerName], { onLog: log, timeoutMs: 30_000 }).catch(() => undefined);
    await runCommand(
      "docker",
      [
        "run",
        "-d",
        "--name",
        containerName,
        "--network",
        config.dockerNetwork,
        "--restart",
        "unless-stopped",
        "--memory",
        config.defaultMemory,
        "--cpus",
        config.defaultCpus,
        "--security-opt",
        "no-new-privileges",
        "-e",
        `PORT=${project.appPort}`,
        ...runtimeEnv,
        deployment.imageTag,
      ],
      { onLog: log, timeoutMs: 60_000 },
    );

    await log("Regenerating reverse proxy config");
    await prisma.deployment.updateMany({
      where: { projectId: project.id, id: { not: deployment.id }, status: "running" },
      data: { status: "canceled", finishedAt: new Date() },
    });
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "running", containerName, finishedAt: new Date() },
    });
    await regenerateCaddyfile(prisma);

    await log("Deployment is running");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deploy error";
    await log(message, "stderr");
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "failed", errorMessage: message, finishedAt: new Date() },
    });
    throw error;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
