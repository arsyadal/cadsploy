import type { FastifyInstance } from "fastify";
import { BuildMethod, EnvScope } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { config } from "../config.js";
import { encryptText, decryptText } from "../crypto.js";
import { prisma } from "../db.js";
import { deployQueue } from "../queue.js";

const slugSchema = z.string().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const envKeySchema = z.string().min(1).max(128).regex(/^[A-Z_][A-Z0-9_]*$/);

function publicProject(project: any) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    branch: project.branch,
    buildMethod: project.buildMethod,
    appPort: project.appPort,
    status: project.status,
    url: config.baseDomain === "localhost"
      ? `http://${project.slug}.${config.baseDomain}:8080`
      : `https://${project.slug}.${config.baseDomain}`,
    createdAt: project.createdAt,
    domains: project.domains ?? [],
  };
}

export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/projects", async (request) => {
    const user = await requireUser(request);
    const projects = await prisma.project.findMany({
      where: { userId: user.id, status: { not: "deleted" } },
      include: { domains: true },
      orderBy: { createdAt: "desc" },
    });
    return { projects: projects.map(publicProject) };
  });

  app.post("/api/projects", async (request) => {
    const user = await requireUser(request);
    const body = z.object({
      name: z.string().min(1).max(80),
      slug: slugSchema,
      repoOwner: z.string().min(1).max(100),
      repoName: z.string().min(1).max(100),
      repoUrl: z.string().url(),
      branch: z.string().min(1).max(120),
      buildMethod: z.nativeEnum(BuildMethod),
      appPort: z.coerce.number().int().min(1).max(65535),
    }).parse(request.body);

    const hostname = `${body.slug}.${config.baseDomain}`;
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: body.name,
        slug: body.slug,
        repoOwner: body.repoOwner,
        repoName: body.repoName,
        repoUrl: body.repoUrl,
        branch: body.branch,
        buildMethod: body.buildMethod,
        appPort: body.appPort,
        domains: { create: { hostname } },
      },
      include: { domains: true },
    });

    return { project: publicProject(project) };
  });

  app.get("/api/projects/:id", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: user.id, status: { not: "deleted" } },
      include: { domains: true, deployments: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!project) throw app.httpErrors.notFound("Project not found");
    return { project: publicProject(project), deployments: project.deployments };
  });

  app.patch("/api/projects/:id", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      branch: z.string().min(1).max(120).optional(),
      buildMethod: z.nativeEnum(BuildMethod).optional(),
      appPort: z.coerce.number().int().min(1).max(65535).optional(),
    }).parse(request.body);

    const project = await prisma.project.update({
      where: { id: params.id, userId: user.id },
      data: body,
      include: { domains: true },
    });
    return { project: publicProject(project) };
  });

  app.delete("/api/projects/:id", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    await prisma.project.update({ where: { id: project.id }, data: { status: "deleted" } });
    await prisma.deployment.updateMany({ where: { projectId: project.id, status: "running" }, data: { status: "canceled", finishedAt: new Date() } });
    await deployQueue.add("regenerate-caddy", {});
    return { ok: true };
  });

  app.post("/api/projects/:id/deployments", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id, status: "active" } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        imageTag: `cadsploy/${project.slug}:${Date.now()}`,
        status: "queued",
      },
    });

    await deployQueue.add("deploy", { deploymentId: deployment.id }, { jobId: deployment.id });
    return { deployment };
  });

  app.get("/api/projects/:id/deployments", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const deployments = await prisma.deployment.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } });
    return { deployments };
  });

  app.get("/api/deployments/:id", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const deployment = await prisma.deployment.findFirst({ where: { id: params.id, project: { userId: user.id } } });
    if (!deployment) throw app.httpErrors.notFound("Deployment not found");
    return { deployment };
  });

  app.get("/api/deployments/:id/logs", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const deployment = await prisma.deployment.findFirst({ where: { id: params.id, project: { userId: user.id } } });
    if (!deployment) throw app.httpErrors.notFound("Deployment not found");

    const logs = await prisma.buildLog.findMany({ where: { deploymentId: params.id }, orderBy: { createdAt: "asc" }, take: 1000 });
    return { logs };
  });

  app.get("/api/projects/:id/env", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const env = await prisma.envVar.findMany({ where: { projectId: project.id }, orderBy: { key: "asc" } });
    return { env: env.map((item) => ({ id: item.id, key: item.key, scope: item.scope, createdAt: item.createdAt, masked: "••••••••" })) };
  });

  app.post("/api/projects/:id/env", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ key: envKeySchema, value: z.string().min(1), scope: z.nativeEnum(EnvScope).default("both") }).parse(request.body);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const env = await prisma.envVar.upsert({
      where: { projectId_key: { projectId: project.id, key: body.key } },
      update: { valueEncrypted: encryptText(body.value), scope: body.scope },
      create: { projectId: project.id, key: body.key, valueEncrypted: encryptText(body.value), scope: body.scope },
    });
    return { env: { id: env.id, key: env.key, scope: env.scope, masked: "••••••••" } };
  });

  app.delete("/api/projects/:id/env/:envId", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid(), envId: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");
    await prisma.envVar.deleteMany({ where: { id: params.envId, projectId: project.id } });
    return { ok: true };
  });

  app.get("/api/projects/:id/domains", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const domains = await prisma.domain.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" }
    });
    return { domains };
  });

  app.post("/api/projects/:id/domains", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      hostname: z.string().min(3).max(255).transform((val) => val.trim().toLowerCase())
    }).parse(request.body);

    const domainRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(body.hostname)) {
      throw app.httpErrors.badRequest("Invalid hostname format. Must be a valid domain or subdomain (e.g. app.mydomain.com)");
    }

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const existing = await prisma.domain.findUnique({ where: { hostname: body.hostname } });
    if (existing) {
      throw app.httpErrors.conflict("This domain is already registered in Cadsploy");
    }

    const domain = await prisma.domain.create({
      data: {
        projectId: project.id,
        hostname: body.hostname,
        type: "custom",
        status: "active"
      }
    });

    await deployQueue.add("regenerate-caddy", {});
    return { domain };
  });

  app.delete("/api/projects/:id/domains/:domainId", async (request) => {
    const user = await requireUser(request);
    const params = z.object({
      id: z.string().uuid(),
      domainId: z.string().uuid()
    }).parse(request.params);

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const domain = await prisma.domain.findFirst({
      where: { id: params.domainId, projectId: project.id }
    });
    if (!domain) throw app.httpErrors.notFound("Domain not found");

    if (domain.type === "generated") {
      throw app.httpErrors.badRequest("The default system domain cannot be deleted");
    }

    await prisma.domain.delete({ where: { id: domain.id } });
    await deployQueue.add("regenerate-caddy", {});
    return { ok: true };
  });

  app.get("/api/projects/:id/databases", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const databases = await prisma.databaseService.findMany({
      where: { projectId: project.id, status: { not: "deleted" } },
      orderBy: { createdAt: "asc" }
    });

    return {
      databases: databases.map((db) => ({
        ...db,
        dbPassword: db.dbPassword ? decryptText(db.dbPassword) : null
      }))
    };
  });

  app.post("/api/projects/:id/databases", async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      name: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
      type: z.enum(["postgres", "redis"])
    }).parse(request.body);

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const nameConflict = await prisma.databaseService.findFirst({
      where: { projectId: project.id, name: body.name, status: { not: "deleted" } }
    });
    if (nameConflict) {
      throw app.httpErrors.conflict("A database service with this name already exists in this project");
    }

    const containerName = `cadsploy-db-${body.name}-${project.slug}`;

    const containerConflict = await prisma.databaseService.findFirst({
      where: { containerName, status: { not: "deleted" } }
    });
    if (containerConflict) {
      throw app.httpErrors.conflict("A database container with this name already exists");
    }

    const existing = await prisma.databaseService.findMany({ where: { type: body.type, status: { not: "deleted" } } });
    const maxAssignedPort = existing.reduce((max, curr) => Math.max(max, curr.hostPort), 0);
    const basePort = body.type === "postgres" ? 5440 : 6380;
    const hostPort = maxAssignedPort > 0 ? maxAssignedPort + 1 : basePort;

    const dbPort = body.type === "postgres" ? 5432 : 6379;
    const dbPassword = body.type === "postgres" ? encryptText(Math.random().toString(36).slice(-10)) : null;

    const db = await prisma.databaseService.create({
      data: {
        projectId: project.id,
        name: body.name,
        type: body.type,
        status: "creating",
        containerName,
        dbName: body.type === "postgres" ? "cadsploy" : null,
        dbUser: body.type === "postgres" ? "cadsploy" : null,
        dbPassword,
        port: dbPort,
        hostPort
      }
    });

    await deployQueue.add("deploy-database", { databaseId: db.id });
    return { database: db };
  });

  app.delete("/api/projects/:id/databases/:databaseId", async (request) => {
    const user = await requireUser(request);
    const params = z.object({
      id: z.string().uuid(),
      databaseId: z.string().uuid()
    }).parse(request.params);

    const project = await prisma.project.findFirst({ where: { id: params.id, userId: user.id } });
    if (!project) throw app.httpErrors.notFound("Project not found");

    const db = await prisma.databaseService.findFirst({
      where: { id: params.databaseId, projectId: project.id }
    });
    if (!db) throw app.httpErrors.notFound("Database service not found");

    await prisma.databaseService.update({
      where: { id: db.id },
      data: { status: "deleted" }
    });

    await deployQueue.add("delete-database", { databaseId: db.id });
    return { ok: true };
  });
}
