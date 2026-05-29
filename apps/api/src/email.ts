import nodemailer from "nodemailer";
import { config } from "./config.js";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass,
  },
});

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; padding: 0 16px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 32px; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo-mark { width: 20px; height: 20px; background: repeating-linear-gradient(-45deg, #d7ff42 0 3px, transparent 3px 6px); border: 1.5px solid #d7ff42; }
    .logo-text { font-size: 16px; font-weight: 700; letter-spacing: -0.5px; color: #fff; }
    .logo-sub { color: #71717a; font-weight: 400; margin-left: 4px; }
    h2 { font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 12px; letter-spacing: -0.5px; }
    p { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #d7ff42; color: #000; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin: 8px 0 20px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .operational { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid #10b981; }
    .partial_outage { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid #f59e0b; }
    .major_outage { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid #ef4444; }
    .divider { border: none; border-top: 1px solid #27272a; margin: 24px 0; }
    .footer { font-size: 11px; color: #52525b; margin-top: 24px; }
    .footer a { color: #71717a; }
    table.services { width: 100%; border-collapse: collapse; margin: 16px 0; }
    table.services td { padding: 8px 0; border-bottom: 1px solid #27272a; font-size: 13px; color: #d4d4d8; }
    table.services td:last-child { text-align: right; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">
        <div class="logo-mark"></div>
        <div class="logo-text">CADSPLOY<span class="logo-sub">/ status</span></div>
      </div>
      ${body}
      <hr class="divider" />
      <div class="footer">
        You are receiving this email because you subscribed to Cadsploy Status updates.<br />
        <a href="https://cadsploy.dev/status">View status page</a> &middot; 
        <a href="{{unsubscribe_url}}">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendConfirmationEmail(email: string, token: string, baseUrl: string) {
  const confirmUrl = `${baseUrl}/api/status/confirm/${token}`;

  const body = `
    <h2>Confirm your subscription</h2>
    <p>You requested to receive status update notifications from Cadsploy. Click the button below to confirm your subscription.</p>
    <a href="${confirmUrl}" class="btn">Confirm Subscription</a>
    <p style="font-size:12px; color:#52525b;">If you did not request this, you can safely ignore this email. This link expires in 24 hours.</p>
  `;

  await transporter.sendMail({
    from: config.smtpFrom,
    to: email,
    subject: "Confirm your Cadsploy Status subscription",
    html: baseTemplate("Confirm Subscription – Cadsploy", body).replace("{{unsubscribe_url}}", `${baseUrl}/api/status/unsubscribe/${token}`),
  });
}

export async function sendWelcomeEmail(email: string, token: string, baseUrl: string) {
  const body = `
    <h2>You're now subscribed</h2>
    <p>You will receive email notifications whenever Cadsploy experiences a status change — whether that's a planned maintenance window or an unexpected outage.</p>
    <p>Current status: <span class="status-badge operational">All Systems Operational</span></p>
    <a href="${baseUrl}/status" class="btn">View Status Page</a>
  `;

  await transporter.sendMail({
    from: config.smtpFrom,
    to: email,
    subject: "You're subscribed to Cadsploy Status updates",
    html: baseTemplate("Welcome – Cadsploy Status", body).replace("{{unsubscribe_url}}", `${baseUrl}/api/status/unsubscribe/${token}`),
  });
}

type ServiceMap = Record<string, string>;

export async function sendStatusChangeEmail(
  email: string,
  token: string,
  baseUrl: string,
  newStatus: string,
  services: ServiceMap
) {
  const statusLabel = 
    newStatus === "operational" ? "All Systems Operational" :
    newStatus === "partial_outage" ? "Partial System Outage" :
    "Major System Outage";

  const badgeClass = newStatus === "operational" ? "operational" : newStatus === "partial_outage" ? "partial_outage" : "major_outage";

  const affectedRows = Object.entries(services)
    .map(([svc, status]) => {
      const dot = status === "operational" ? "#10b981" : "#ef4444";
      return `<tr><td>${svc}</td><td style="color:${dot}; font-weight:600;">${status === "operational" ? "Operational" : "Outage"}</td></tr>`;
    })
    .join("");

  const body = `
    <h2>System status changed</h2>
    <p>Cadsploy platform status has changed to:</p>
    <p><span class="status-badge ${badgeClass}">${statusLabel}</span></p>
    <table class="services">
      <tr><td colspan="2" style="color:#71717a; font-size:11px; text-transform:uppercase; padding-bottom:8px;">Service Details</td></tr>
      ${affectedRows}
    </table>
    <a href="${baseUrl}/status" class="btn">View Status Page</a>
    <p style="font-size:12px; color:#52525b;">Our team has been alerted and is actively investigating any issues.</p>
  `;

  const subject = newStatus === "operational"
    ? "Cadsploy – All Systems Operational"
    : newStatus === "partial_outage"
      ? "Cadsploy – Partial System Outage Detected"
      : "Cadsploy – Major System Outage Detected";

  await transporter.sendMail({
    from: config.smtpFrom,
    to: email,
    subject,
    html: baseTemplate(subject, body).replace("{{unsubscribe_url}}", `${baseUrl}/api/status/unsubscribe/${token}`),
  });
}
