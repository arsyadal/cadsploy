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
    const deployment = await prisma.deployment.findFirst({ where: { id: params.id, project: { userId: user.id }, containerName: { not: null } } });
    if (!deployment?.containerName) throw app.httpErrors.notFound("Running deployment not found");

    await runDockerCommand(["restart", deployment.containerName], 20_000);
    return { ok: true };
  });
}
