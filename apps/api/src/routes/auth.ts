import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config, isProduction } from "../config.js";
import { encryptText } from "../crypto.js";
import { prisma } from "../db.js";
import { clearSession, createSession, getCurrentUser } from "../auth.js";
import { randomToken } from "../crypto.js";

const stateCookieName = "cadsploy_oauth_state";

const githubTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().nullable(),
  email: z.string().email().nullable(),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/github", async (_request, reply) => {
    if (!config.githubClientId || !config.githubClientSecret) {
      throw app.httpErrors.internalServerError("GitHub OAuth env is not configured");
    }

    const state = randomToken(24);
    reply.setCookie(stateCookieName, state, {
      path: "/auth/github/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 10 * 60,
    });

    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: config.githubCallbackUrl,
      scope: "read:user user:email repo",
      state,
      allow_signup: "true",
    });

    return reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const query = z.object({ code: z.string(), state: z.string() }).parse(request.query);
    const expectedState = request.cookies[stateCookieName];
    if (!expectedState || expectedState !== query.state) {
      throw app.httpErrors.badRequest("Invalid OAuth state");
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code: query.code,
        redirect_uri: config.githubCallbackUrl,
      }),
    });

    if (!tokenResponse.ok) throw app.httpErrors.badGateway("GitHub token exchange failed");
    const tokenPayload = githubTokenSchema.parse(await tokenResponse.json());

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Cadsploy",
      },
    });

    if (!userResponse.ok) throw app.httpErrors.badGateway("GitHub user fetch failed");
    const githubUser = githubUserSchema.parse(await userResponse.json());

    let email = githubUser.email;
    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Cadsploy",
        },
      });
      if (emailResponse.ok) {
        const emails = z.array(z.object({ email: z.string().email(), primary: z.boolean(), verified: z.boolean() })).parse(await emailResponse.json());
        email = emails.find((item) => item.primary && item.verified)?.email ?? null;
      }
    }

    const user = await prisma.user.upsert({
      where: { githubId: String(githubUser.id) },
      update: {
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        githubAccessTokenEncrypted: encryptText(tokenPayload.access_token),
      },
      create: {
        githubId: String(githubUser.id),
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        githubAccessTokenEncrypted: encryptText(tokenPayload.access_token),
      },
    });

    await createSession(user.id, reply);
    reply.clearCookie(stateCookieName, { path: "/auth/github/callback" });
    return reply.redirect(`${config.publicAppUrl}/dashboard`);
  });

  app.get("/auth/me", async (request) => {
    const user = await getCurrentUser(request);
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    await clearSession(request, reply);
    return { ok: true };
  });
}
