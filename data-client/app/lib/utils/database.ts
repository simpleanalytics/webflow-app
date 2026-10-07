import { createClient } from "redis";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
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

function authorizationSitesKey(accessToken: string): string {
  const fingerprint = createHash("sha256").update(accessToken).digest("hex");
  return `authorization:${fingerprint}:sites`;
}

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
  const siteKey = `site:${siteId}`;
  const previous = await db.get(siteKey);
  let previousSitesKey: string | undefined;
  if (previous) {
    try {
      const previousToken = decrypt(previous);
      if (previousToken !== accessToken) {
        previousSitesKey = authorizationSitesKey(previousToken);
      }
    } catch {
      // Replacing an unreadable entry repairs the site mapping.
    }
  }
  const sitesKey = authorizationSitesKey(accessToken);
  await db.eval(
    `redis.call("SET", KEYS[1], ARGV[1])
     redis.call("SADD", KEYS[2], ARGV[2])
     if KEYS[3] then
       redis.call("SREM", KEYS[3], ARGV[2])
       if redis.call("SCARD", KEYS[3]) == 0 then redis.call("DEL", KEYS[3]) end
     end
     return 1`,
    {
      keys: previousSitesKey
        ? [siteKey, sitesKey, previousSitesKey]
        : [siteKey, sitesKey],
      arguments: [encrypt(accessToken), siteId],
    }
  );
}

export async function removeSiteAuthorization(
  siteId: string,
  accessToken: string
): Promise<number> {
  const db = await getRedis();
  const key = `site:${siteId}`;
  const ciphertext = await db.get(key);
  if (!ciphertext) throw new Error("Site authorization changed");

  if (decrypt(ciphertext) !== accessToken) throw new Error("Site authorization changed");

  // One Webflow grant can authorize multiple sites. Only revoke it upstream
  // after its final site mapping has been removed.
  const sitesKey = authorizationSitesKey(accessToken);
  const result = await db.eval(
    `if redis.call("GET", KEYS[1]) ~= ARGV[1] then return -1 end
     redis.call("DEL", KEYS[1])
     redis.call("SREM", KEYS[2], ARGV[2])
     return redis.call("SCARD", KEYS[2])`,
    { keys: [key, sitesKey], arguments: [ciphertext, siteId] }
  );
  if (result === -1) throw new Error("Site authorization changed");
  let remainingSites = Number(result);

  if (remainingSites === 0) {
    // Backfill the index for mappings written before disconnect support.
    for await (const keys of db.scanIterator({ MATCH: "site:*", COUNT: 100 })) {
      if (keys.length === 0) continue;
      const values = await db.mGet(keys);
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (!value) continue;
        try {
          if (decrypt(value) === accessToken) {
            await db.sAdd(sitesKey, keys[index].slice("site:".length));
            remainingSites += 1;
          }
        } catch {
          // Ignore unrelated corrupt entries; they cannot contain this token.
        }
      }
    }
  }

  if (remainingSites === 0) await db.del(sitesKey);
  return remainingSites;
}

export async function getAccessTokenFromSiteId(siteId: string): Promise<string> {
  const db = await getRedis();
  const ciphertext = await db.get(`site:${siteId}`);
  if (!ciphertext) throw new Error("Site is not authorized");
  return decrypt(ciphertext);
}

export default {
  insertSiteAuthorization,
  removeSiteAuthorization,
  getAccessTokenFromSiteId,
};
