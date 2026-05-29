import { PrismaClient } from "@prisma/client";
import { deployQueue } from "./queue.js";

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
}
