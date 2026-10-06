import { createClient } from "redis";
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { requiredEnv } from "./config";

// Only ciphertext is persisted, including in Redis AOF/snapshots.
export function encrypt(plaintext: string): string {
  const key = scryptSync(requiredEnv("WEBFLOW_CLIENT_SECRET"), "simple-analytics-salt", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(encoded: string): string {
  const key = scryptSync(requiredEnv("WEBFLOW_CLIENT_SECRET"), "simple-analytics-salt", 32);
  const [iv, tag, ciphertext] = encoded.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;

export async function getRedis() {
  if (!client) {
    client = createClient({
      url: requiredEnv("REDIS_URL"),
      disableOfflineQueue: true,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });
    // Never log connection URLs, credentials or token values.
    client.on("error", () => console.error("Webflow Redis connection failed"));
  }
  if (!client.isReady) {
    connecting ??= client.connect().finally(() => { connecting = undefined; });
    await connecting;
  }
  return client.withCommandOptions({ abortSignal: AbortSignal.timeout(2000) });
}

export async function insertSiteAuthorization(siteId: string, accessToken: string) {
  const db = await getRedis();
  await db.set(`site:${siteId}`, encrypt(accessToken));
}

export async function getAccessTokenFromSiteId(siteId: string): Promise<string> {
  const db = await getRedis();
  const ciphertext = await db.get(`site:${siteId}`);
  if (!ciphertext) throw new Error("Site is not authorized");
  return decrypt(ciphertext);
}

export default { insertSiteAuthorization, getAccessTokenFromSiteId };
