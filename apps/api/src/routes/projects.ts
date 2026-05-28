import type { FastifyInstance } from "fastify";
import { BuildMethod, EnvScope } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { config } from "../config.js";
import { encryptText } from "../crypto.js";
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
    url: `https://${project.slug}.${config.baseDomain}`,
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
}
