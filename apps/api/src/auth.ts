import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { prisma } from "./db.js";
import { hashToken, randomToken } from "./crypto.js";
import { isProduction } from "./config.js";

export const sessionCookieName = "cadsploy_session";

export async function createSession(userId: string, reply: FastifyReply) {
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });

  reply.setCookie(sessionCookieName, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getCurrentUser(request: FastifyRequest): Promise<User | null> {
  const token = request.cookies[sessionCookieName];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser(request: FastifyRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) throw request.server.httpErrors.unauthorized("Authentication required");
  return user;
}

export async function clearSession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[sessionCookieName];
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  reply.clearCookie(sessionCookieName, { path: "/" });
}
