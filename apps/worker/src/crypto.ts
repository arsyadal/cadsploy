import crypto from "node:crypto";
import { config } from "./config.js";

const algorithm = "aes-256-gcm";
const key = crypto.createHash("sha256").update(config.encryptionKey).digest();

export function decryptText(payload: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted payload");

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
