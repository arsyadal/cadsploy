import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { prisma } from "../db.js";

const execFileAsync = promisify(execFile);

async function runDockerCommand(args: string[], timeoutMs: number) {
  let cmd = "docker";
  let cmdArgs = args;

  if (process.platform === "win32") {
    cmd = "wsl";
    cmdArgs = ["docker", ...args];
  }

  return execFileAsync(cmd, cmdArgs, { timeout: timeoutMs, maxBuffer: 1024 * 512 });
}

export async function runtimeRoutes(app: FastifyInstance) {
  app.get("/api/projects/:id/runtime-logs", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const deployment = await prisma.deployment.findFirst({
      where: { projectId: project.id, status: "running", containerName: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!deployment?.containerName) return { logs: "" };

    try {
      const { stdout, stderr } = await runDockerCommand(["logs", "--tail", "300", deployment.containerName], 10_000);
      return { logs: `${stdout}${stderr}` };
    } catch (error) {
      request.log.warn({ error }, "failed to read runtime logs");
      return { logs: "Unable to read runtime logs." };
    }
  });

  app.post("/api/deployments/:id/restart", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const deployment = await prisma.deployment.findFirst({
      where: {
        id: params.id,
        status: "running",
        project: { userId: user.id },
        containerName: { not: null },
      },
    });
    if (!deployment?.containerName) throw app.httpErrors.badRequest("No active running container found for this deployment");

    await runDockerCommand(["restart", deployment.containerName], 20_000);
    return { ok: true };
  });

  app.get("/api/projects/:id/stats", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const activeDeployment = await prisma.deployment.findFirst({
      where: { projectId: project.id, status: "running", containerName: { not: null } }
    });

    const activeDatabases = await prisma.databaseService.findMany({
      where: { projectId: project.id, status: "running" }
    });

    const containerNames: string[] = [];
    if (activeDeployment?.containerName) {
      containerNames.push(activeDeployment.containerName);
    }
    for (const db of activeDatabases) {
      containerNames.push(db.containerName);
    }

    if (containerNames.length === 0) {
      return { stats: [] };
    }

    try {
      const { stdout } = await runDockerCommand([
        "stats",
        "--no-stream",
        "--format",
        "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}",
        ...containerNames
      ], 15_000);

      const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const stats = lines.map((line) => {
        const [name, cpu, memoryUsage, memoryPerc] = line.split(",");
        return {
          name: name?.trim(),
          cpu: cpu?.trim(),
          memoryUsage: memoryUsage?.trim(),
          memoryPerc: memoryPerc?.trim()
        };
      });

      return { stats };
    } catch (error) {
      request.log.warn({ error }, "failed to read container stats");
      return { stats: [] };
    }
  });
}
