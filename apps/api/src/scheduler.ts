import { PrismaClient } from "@prisma/client";
import { deployQueue } from "./queue.js";
import { config } from "./config.js";
import { sendStatusChangeEmail } from "./email.js";

const prisma = new PrismaClient();

function getNextBackupTime(interval: string): Date {
  const next = new Date();
  if (interval === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (interval === "weekly") {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export function startScheduler() {
  console.log("[scheduler] Cadsploy background scheduler started");

  // 1. Health Checks Scheduler Loop (Every 30 seconds)
  setInterval(async () => {
    try {
      const activeProjects = await prisma.project.findMany({
        where: {
          status: "active",
          healthCheckPath: { not: null }
        }
      });

      for (const project of activeProjects) {
        if (!project.healthCheckPath) continue;

        let checkSucceeded = false;
        try {
          // Send internal request to Caddy exposed port (8080) with Host header
          const res = await fetch(`http://127.0.0.1:8080${project.healthCheckPath}`, {
            headers: {
              Host: `${project.slug}.localhost`
            },
            signal: AbortSignal.timeout(8000)
          });
          
          if (res.status < 400) {
            checkSucceeded = true;
          }
        } catch (err) {
          // Failed to connect or timeout
          checkSucceeded = false;
        }

        const wasHealthy = project.isHealthy;
        
        // Update database with latest health check time
        await prisma.project.update({
          where: { id: project.id },
          data: {
            isHealthy: checkSucceeded,
            lastHealthCheckAt: new Date()
          }
        });

        // Trigger Auto-Restart if the container transitioned from healthy to unhealthy
        if (wasHealthy && !checkSucceeded) {
          console.warn(`[scheduler] Project ${project.slug} is unhealthy. Triggering auto-restart...`);
          await deployQueue.add("restart-container", { projectId: project.id });
        }
      }
    } catch (error) {
      console.error("[scheduler] Error in health check loop:", error);
    }
  }, 30_000);

  // 2. Automated Backups Scheduler Loop (Every 60 seconds)
  setInterval(async () => {
    try {
      const now = new Date();

      // A. Database Services Auto-Backups
      const databasesToBackup = await prisma.databaseService.findMany({
        where: {
          backupInterval: { not: "none" },
          nextBackupAt: { lte: now }
        }
      });

      for (const db of databasesToBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ext = db.type === "postgres" ? "dump" : "rdb";
        const fileName = `${db.name}-backup-${timestamp}.${ext}`;

        const backup = await prisma.databaseBackup.create({
          data: {
            databaseServiceId: db.id,
            fileName,
            status: "pending"
          }
        });

        // Add backup database job to queue
        await deployQueue.add("backup-database", { backupId: backup.id });

        // Update database next backup time
        const nextTime = getNextBackupTime(db.backupInterval);
        await prisma.databaseService.update({
          where: { id: db.id },
          data: { nextBackupAt: nextTime }
        });

        console.log(`[scheduler] Triggered scheduled ${db.backupInterval} backup for database: ${db.name}`);
      }

      // B. Persistent Volumes Auto-Backups
      const volumesToBackup = await prisma.persistentVolume.findMany({
        where: {
          backupInterval: { not: "none" },
          nextBackupAt: { lte: now }
        },
        include: { project: true }
      });

      for (const vol of volumesToBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${vol.project.slug}-${vol.name}-backup-${timestamp}.tar.gz`;

        const backup = await prisma.volumeBackup.create({
          data: {
            persistentVolumeId: vol.id,
            fileName,
            status: "pending"
          }
        });

        // Add backup volume job to queue
        await deployQueue.add("backup-volume", { volumeBackupId: backup.id });

        // Update volume next backup time
        const nextTime = getNextBackupTime(vol.backupInterval);
        await prisma.persistentVolume.update({
          where: { id: vol.id },
          data: { nextBackupAt: nextTime }
        });

        console.log(`[scheduler] Triggered scheduled ${vol.backupInterval} backup for volume: ${vol.name} (${vol.project.slug})`);
      }

    } catch (error) {
      console.error("[scheduler] Error in auto-backups loop:", error);
    }
  }, 60_000);

  // 3. Status Change Monitor (every 60 seconds) — send emails when status changes
  setInterval(async () => {
    try {
      // Inline health check (same logic as /api/status/health)
      let dbStatus: "operational" | "major_outage" = "operational";
      try { await prisma.$queryRaw`SELECT 1`; } catch { dbStatus = "major_outage"; }

      let redisStatus: "operational" | "major_outage" = "operational";
      try {
        const net = await import("node:net");
        await new Promise<void>((resolve, reject) => {
          const socket = net.connect(6379, "127.0.0.1", () => { socket.end(); resolve(); });
          socket.on("error", reject);
          socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("timeout")); });
        });
      } catch { redisStatus = "major_outage"; }

      let dockerStatus: "operational" | "major_outage" = "operational";
      try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const exec = promisify(execFile);
        const cmd = process.platform === "win32" ? "wsl" : "docker";
        const args = process.platform === "win32" ? ["docker", "info"] : ["info"];
        await exec(cmd, args, { timeout: 8000 });
      } catch { dockerStatus = "major_outage"; }

      let caddyStatus: "operational" | "major_outage" = "operational";
      try {
        const net = await import("node:net");
        await new Promise<void>((resolve, reject) => {
          const socket = net.connect(8080, "127.0.0.1", () => { socket.end(); resolve(); });
          socket.on("error", reject);
          socket.setTimeout(3000, () => { socket.destroy(); reject(new Error("timeout")); });
        });
      } catch { caddyStatus = "major_outage"; }

      let overallStatus: "operational" | "partial_outage" | "major_outage" = "operational";
      if (dbStatus === "major_outage" || redisStatus === "major_outage" || dockerStatus === "major_outage") {
        overallStatus = "major_outage";
      } else if (caddyStatus === "major_outage") {
        overallStatus = "partial_outage";
      }

      const services = { api: "operational", worker: "operational", caddy: caddyStatus, docker: dockerStatus, postgres: dbStatus, redis: redisStatus };

      // Check last logged status
      const lastLog = await prisma.systemStatusLog.findFirst({ orderBy: { createdAt: "desc" } });
      const lastStatus = lastLog?.status ?? "operational";

      // Only act if status changed
      if (lastStatus !== overallStatus) {
        console.log(`[scheduler] Status changed: ${lastStatus} → ${overallStatus}`);

        // Log the change
        await prisma.systemStatusLog.create({
          data: { status: overallStatus, details: services, notified: false }
        });

        // Notify all confirmed subscribers
        const subscribers = await prisma.statusSubscriber.findMany({ where: { confirmed: true } });
        console.log(`[scheduler] Notifying ${subscribers.length} subscriber(s)`);

        for (const sub of subscribers) {
          try {
            await sendStatusChangeEmail(sub.email, sub.token, config.publicAppUrl, overallStatus, services);
            console.log(`[scheduler] Notified ${sub.email}`);
          } catch (err) {
            console.error(`[scheduler] Failed to notify ${sub.email}:`, err);
          }
        }

        // Mark as notified
        const latest = await prisma.systemStatusLog.findFirst({ orderBy: { createdAt: "desc" } });
        if (latest) {
          await prisma.systemStatusLog.update({ where: { id: latest.id }, data: { notified: true } });
        }
      }
    } catch (error) {
      console.error("[scheduler] Error in status monitor loop:", error);
    }
  }, 60_000);
}
