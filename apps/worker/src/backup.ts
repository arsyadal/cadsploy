import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { runCommand } from "./process.js";
import { decryptText } from "./crypto.js";
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

export async function backupDatabase(backupId: string) {
  const backup = await prisma.databaseBackup.findUnique({
    where: { id: backupId },
    include: { databaseService: true }
  });

  if (!backup) throw new Error(`DatabaseBackup ${backupId} not found`);

  const db = backup.databaseService;

  await prisma.databaseBackup.update({
    where: { id: backup.id },
    data: { status: "pending" }
  });

  try {
    await fs.mkdir(config.backupsDir, { recursive: true });

    const fileExt = db.type === "postgres" ? "dump" : "rdb";
    const filePath = path.resolve(config.backupsDir, `${backup.id}.${fileExt}`);

    if (db.type === "postgres") {
      const password = db.dbPassword ? decryptText(db.dbPassword) : "";
      
      // 1. Run pg_dump inside container
      const dumpArgs = [
        "exec",
        "-e",
        `PGPASSWORD=${password}`,
        db.containerName,
        "pg_dump",
        "-U",
        db.dbUser || "cadsploy",
        "-d",
        db.dbName || "cadsploy",
        "-F",
        "c",
        "-f",
        "/tmp/backup.dump"
      ];
      await runCommand("docker", dumpArgs, { timeoutMs: 60_000 });

      // 2. Copy the dump file to host
      await runCommand("docker", ["cp", `${db.containerName}:/tmp/backup.dump`, toWslPath(filePath)], { timeoutMs: 30_000 });

      // 3. Clean up the dump file inside container
      await runCommand("docker", ["exec", db.containerName, "rm", "-f", "/tmp/backup.dump"], { timeoutMs: 15_000 }).catch(() => undefined);

    } else if (db.type === "redis") {
      // 1. Run redis-cli save
      await runCommand("docker", ["exec", db.containerName, "redis-cli", "save"], { timeoutMs: 30_000 });

      // 2. Copy the dump.rdb file to host
      await runCommand("docker", ["cp", `${db.containerName}:/data/dump.rdb`, toWslPath(filePath)], { timeoutMs: 30_000 });
    }

    const stat = await fs.stat(filePath);

    await prisma.databaseBackup.update({
      where: { id: backup.id },
      data: {
        status: "completed",
        fileSize: stat.size,
        completedAt: new Date()
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup error";
    await prisma.databaseBackup.update({
      where: { id: backup.id },
      data: {
        status: "failed",
        errorMessage: message
      }
    });
    throw error;
  }
}

export async function restoreDatabase(backupId: string) {
  const backup = await prisma.databaseBackup.findUnique({
    where: { id: backupId },
    include: { databaseService: true }
  });

  if (!backup) throw new Error(`DatabaseBackup ${backupId} not found`);

  const db = backup.databaseService;
  const fileExt = db.type === "postgres" ? "dump" : "rdb";
  const filePath = path.resolve(config.backupsDir, `${backup.id}.${fileExt}`);

  // Confirm file exists
  await fs.access(filePath);

  try {
    if (db.type === "postgres") {
      const password = db.dbPassword ? decryptText(db.dbPassword) : "";

      // 1. Copy backup file to container
      await runCommand("docker", ["cp", toWslPath(filePath), `${db.containerName}:/tmp/restore.dump`], { timeoutMs: 30_000 });

      // 2. Execute pg_restore (clean and recreate tables/views)
      const restoreArgs = [
        "exec",
        "-e",
        `PGPASSWORD=${password}`,
        db.containerName,
        "pg_restore",
        "-U",
        db.dbUser || "cadsploy",
        "-d",
        db.dbName || "cadsploy",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "/tmp/restore.dump"
      ];
      // Note: pg_restore exits with code 1 if there are minor warnings, but let's run it.
      await runCommand("docker", restoreArgs, { timeoutMs: 90_000 });

      // 3. Clean up the restore file inside container
      await runCommand("docker", ["exec", db.containerName, "rm", "-f", "/tmp/restore.dump"], { timeoutMs: 15_000 }).catch(() => undefined);

    } else if (db.type === "redis") {
      // 1. Stop Redis container
      await runCommand("docker", ["stop", db.containerName], { timeoutMs: 30_000 });

      // 2. Copy the backup RDB file back to container
      await runCommand("docker", ["cp", toWslPath(filePath), `${db.containerName}:/data/dump.rdb`], { timeoutMs: 30_000 });

      // 3. Start Redis container again
      await runCommand("docker", ["start", db.containerName], { timeoutMs: 30_000 });
    }
  } catch (error) {
    console.error(`Failed to restore database ${db.name}:`, error);
    throw error;
  }
}
