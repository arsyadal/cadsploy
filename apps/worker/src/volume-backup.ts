import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { runCommand } from "./process.js";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

function toWslPath(windowsPath: string): string {
  let p = windowsPath.replace(/\\/g, "/");
  const match = p.match(/^([a-zA-Z]):/);
  if (match && match[1]) {
    const drive = match[1].toLowerCase();
    p = p.replace(/^[a-zA-Z]:/, `/mnt/${drive}`);
  }
  return p;
}

export async function backupVolume(volumeBackupId: string) {
  const backup = await prisma.volumeBackup.findUnique({
    where: { id: volumeBackupId },
    include: {
      persistentVolume: {
        include: { project: true }
      }
    }
  });

  if (!backup) throw new Error(`VolumeBackup ${volumeBackupId} not found`);

  const volume = backup.persistentVolume;
  const project = volume.project;

  await prisma.volumeBackup.update({
    where: { id: backup.id },
    data: { status: "pending" }
  });

  try {
    await fs.mkdir(config.backupsDir, { recursive: true });

    const hostBackupPath = path.resolve(config.backupsDir, `${backup.id}.tar.gz`);
    const volumeFolderName = `${project.slug}-${volume.name}`;

    const wslVolumeDir = toWslPath(config.volumesDir);
    const wslBackupFile = toWslPath(hostBackupPath);

    // Run tar compress in WSL: wsl tar -czf <backup.tar.gz> -C <volumesDir> <folderName>
    await runCommand("wsl", [
      "tar",
      "-czf",
      wslBackupFile,
      "-C",
      wslVolumeDir,
      volumeFolderName
    ], { timeoutMs: 120_000 });

    const stat = await fs.stat(hostBackupPath);

    await prisma.volumeBackup.update({
      where: { id: backup.id },
      data: {
        status: "completed",
        fileSize: stat.size,
        completedAt: new Date()
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown volume backup error";
    await prisma.volumeBackup.update({
      where: { id: backup.id },
      data: {
        status: "failed",
        errorMessage: message
      }
    });
    throw error;
  }
}

export async function restoreVolume(volumeBackupId: string) {
  const backup = await prisma.volumeBackup.findUnique({
    where: { id: volumeBackupId },
    include: {
      persistentVolume: {
        include: { project: true }
      }
    }
  });

  if (!backup) throw new Error(`VolumeBackup ${volumeBackupId} not found`);

  const volume = backup.persistentVolume;
  const project = volume.project;
  const containerName = `cadsploy-${project.slug}`;

  const hostBackupPath = path.resolve(config.backupsDir, `${backup.id}.tar.gz`);
  const hostVolumePath = path.resolve(config.volumesDir, `${project.slug}-${volume.name}`);

  // Confirm backup file exists
  await fs.access(hostBackupPath);

  try {
    // 1. Stop active container (releasing locks)
    await runCommand("docker", ["stop", containerName], { timeoutMs: 45_000 }).catch(() => undefined);

    // 2. Clean volume directory
    await fs.rm(hostVolumePath, { recursive: true, force: true }).catch(() => undefined);
    await fs.mkdir(hostVolumePath, { recursive: true });

    const wslVolumeDir = toWslPath(config.volumesDir);
    const wslBackupFile = toWslPath(hostBackupPath);

    // 3. Extract tar in WSL
    await runCommand("wsl", [
      "tar",
      "-xzf",
      wslBackupFile,
      "-C",
      wslVolumeDir
    ], { timeoutMs: 120_000 });

    // 4. Restart container
    await runCommand("docker", ["start", containerName], { timeoutMs: 45_000 }).catch(() => undefined);

  } catch (error) {
    console.error(`Failed to restore persistent volume ${volume.name}:`, error);
    throw error;
  }
}
