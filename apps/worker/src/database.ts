import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { runCommand } from "./process.js";
import { decryptText } from "./crypto.js";

const prisma = new PrismaClient();

export async function deployDatabase(databaseId: string) {
  const db = await prisma.databaseService.findUnique({
    where: { id: databaseId },
  });

  if (!db) throw new Error(`DatabaseService ${databaseId} not found`);

  await prisma.databaseService.update({
    where: { id: db.id },
    data: { status: "creating" },
  });

  try {
    const containerName = db.containerName;
    // Stop and remove existing container if any
    await runCommand("docker", ["rm", "-f", containerName], { timeoutMs: 30_000 }).catch(() => undefined);

    const runArgs = [
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      config.dockerNetwork,
      "--restart",
      "unless-stopped",
      "-p",
      `${db.hostPort}:${db.port}`,
    ];

    if (db.type === "postgres") {
      const password = db.dbPassword ? decryptText(db.dbPassword) : "postgres";
      runArgs.push(
        "-e",
        `POSTGRES_DB=${db.dbName}`,
        "-e",
        `POSTGRES_USER=${db.dbUser}`,
        "-e",
        `POSTGRES_PASSWORD=${password}`,
        "postgres:16-alpine"
      );
    } else if (db.type === "redis") {
      runArgs.push("redis:7-alpine");
    }

    await runCommand("docker", runArgs, { timeoutMs: 60_000 });

    await prisma.databaseService.update({
      where: { id: db.id },
      data: { status: "running" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown db deploy error";
    await prisma.databaseService.update({
      where: { id: db.id },
      data: { status: "failed" },
    });
    throw error;
  }
}

export async function deleteDatabase(databaseId: string) {
  const db = await prisma.databaseService.findUnique({
    where: { id: databaseId },
  });

  if (!db) return;

  try {
    await runCommand("docker", ["rm", "-f", db.containerName], { timeoutMs: 30_000 }).catch(() => undefined);
    await prisma.databaseService.delete({
      where: { id: db.id },
    });
  } catch (error) {
    console.error(`Failed to delete database container: ${db.containerName}`, error);
    throw error;
  }
}
