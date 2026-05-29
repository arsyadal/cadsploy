import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import {
  sendConfirmationEmail,
  sendWelcomeEmail,
} from "../email.js";

export async function statusSubscriberRoutes(app: FastifyInstance) {
  // POST /api/status/subscribe — register email, send confirmation
  app.post("/api/status/subscribe", async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({ error: "Invalid email address." });
    }

    const { email } = body.data;

    // Check if already subscribed and confirmed
    const existing = await prisma.statusSubscriber.findUnique({ where: { email } });

    if (existing?.confirmed) {
      return reply.status(200).send({
        ok: true,
        message: "This email is already subscribed to status updates.",
        alreadySubscribed: true,
      });
    }

    // Upsert subscriber (create or reset token if unconfirmed)
    const subscriber = existing
      ? existing
      : await prisma.statusSubscriber.create({ data: { email } });

    // Send confirmation email
    try {
      await sendConfirmationEmail(email, subscriber.token, config.apiUrl);
    } catch (err) {
      request.log.error({ err }, "Failed to send confirmation email");
      return reply.status(500).send({ error: "Failed to send confirmation email. Please try again." });
    }

    return reply.status(200).send({
      ok: true,
      message: "Confirmation email sent. Please check your inbox to complete the subscription.",
    });
  });

  // GET /api/status/confirm/:token — confirm subscription
  app.get("/api/status/confirm/:token", async (request, reply) => {
    const params = z.object({ token: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send("Invalid confirmation link.");
    }

    const subscriber = await prisma.statusSubscriber.findUnique({
      where: { token: params.data.token },
    });

    if (!subscriber) {
      return reply.status(404).send("Subscription not found or link expired.");
    }

    if (!subscriber.confirmed) {
      await prisma.statusSubscriber.update({
        where: { id: subscriber.id },
        data: { confirmed: true },
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(subscriber.email, subscriber.token, config.apiUrl);
      } catch (err) {
        request.log.warn({ err }, "Failed to send welcome email after confirmation");
      }
    }

    // Redirect to status page with success message
    return reply.redirect(`${config.publicAppUrl}/status?subscribed=1`);
  });

  // GET /api/status/unsubscribe/:token — one-click unsubscribe
  app.get("/api/status/unsubscribe/:token", async (request, reply) => {
    const params = z.object({ token: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send("Invalid unsubscribe link.");
    }

    const subscriber = await prisma.statusSubscriber.findUnique({
      where: { token: params.data.token },
    });

    if (!subscriber) {
      return reply.redirect(`${config.publicAppUrl}/status?unsubscribed=1`);
    }

    await prisma.statusSubscriber.delete({ where: { id: subscriber.id } });

    return reply.redirect(`${config.publicAppUrl}/status?unsubscribed=1`);
  });
}
