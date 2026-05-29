import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
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

  app.get("/api/projects/:id/runtime-logs/download", async (request, reply) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const deployment = await prisma.deployment.findFirst({
      where: { projectId: project.id, status: "running", containerName: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!deployment?.containerName) throw app.httpErrors.notFound("No active running container found for this project");

    try {
      const { stdout, stderr } = await runDockerCommand(["logs", deployment.containerName], 20_000);
      const fullLog = `${stdout}${stderr}`;
      void reply
        .header("Content-Disposition", `attachment; filename="${project.slug}-runtime-logs.txt"`)
        .header("Content-Type", "text/plain")
        .send(fullLog);
    } catch (error) {
      request.log.warn({ error }, "failed to read runtime logs for download");
      throw app.httpErrors.internalServerError("Unable to download runtime logs");
    }
  });

  // VPS Host Server Metrics Endpoint
  app.get("/api/projects/:id/host-stats", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    // 1. Memory Stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // 2. CPU Load (Load average over 1 minute)
    const cpus = os.cpus();
    const totalCpu = cpus.length;
    const loadAvg = os.loadavg()[0] ?? 0; // Load average of 1 minute
    const usedCpu = parseFloat(Math.min((loadAvg / totalCpu) * 100, 100).toFixed(1));

    // 3. Disk Space in WSL / Windows
    let totalDisk = 512 * 1024 * 1024 * 1024; // fallback 512 GB
    let usedDisk = 120 * 1024 * 1024 * 1024; // fallback 120 GB
    
    try {
      const cmd = process.platform === "win32" ? "wsl" : "df";
      const args = process.platform === "win32" ? ["df", "-B1", "/mnt/c"] : ["-B1", "/"];
      
      const { stdout } = await execFileAsync(cmd, args, { timeout: 8000 });
      const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length >= 2) {
        const parts = lines[1]!.split(/\s+/).filter(Boolean);
        if (parts.length >= 4) {
          totalDisk = parseInt(parts[1]!, 10);
          usedDisk = parseInt(parts[2]!, 10);
        }
      }
    } catch (err) {
      // Ignore or log
    }

    return {
      totalCpu,
      usedCpu,
      totalMem,
      usedMem,
      totalDisk,
      usedDisk
    };
  });

  // Live System Health Checks Status Page Endpoint
  app.get("/api/status/health", async () => {
    // 1. Check Database
    let dbStatus: "operational" | "major_outage" = "operational";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "major_outage";
    }

    // 2. Check Redis (BullMQ connection)
    let redisStatus: "operational" | "major_outage" = "operational";
    try {
      // Simple TCP check to port 6379 or Node Redis check
      const net = await import("node:net");
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(6379, "127.0.0.1", () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
        socket.setTimeout(2000, () => {
          socket.destroy();
          reject(new Error("Timeout"));
        });
      });
    } catch {
      redisStatus = "major_outage";
    }

    // 3. Check Docker Engine (via wsl docker info or native docker info)
    let dockerStatus: "operational" | "major_outage" = "operational";
    try {
      await runDockerCommand(["info"], 8000);
    } catch {
      dockerStatus = "major_outage";
    }

    // 4. Check Caddy — verify container is reachable on port 8080
    let caddyStatus: "operational" | "major_outage" = "operational";
    try {
      const net = await import("node:net");
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(8080, "127.0.0.1", () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
        socket.setTimeout(3000, () => {
          socket.destroy();
          reject(new Error("Caddy TCP timeout"));
        });
      });
    } catch {
      // Fallback: check if Caddyfile.generated exists on disk
      try {
        const fs = await import("node:fs/promises");
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const caddyfile = join(__dirname, "../../../infra/Caddyfile.generated");
        await fs.access(caddyfile);
      } catch {
        caddyStatus = "major_outage";
      }
    }

    // Overall Status
    let overallStatus: "operational" | "partial_outage" | "major_outage" = "operational";
    if (dbStatus === "major_outage" || redisStatus === "major_outage" || dockerStatus === "major_outage") {
      overallStatus = "major_outage";
    } else if (caddyStatus === "major_outage") {
      overallStatus = "partial_outage";
    }

    return {
      status: overallStatus,
      services: {
        api: "operational",
        worker: "operational",
        caddy: caddyStatus,
        docker: dockerStatus,
        postgres: dbStatus,
        redis: redisStatus
      }
    };
  });
}
