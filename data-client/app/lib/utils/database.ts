import { Redis } from "@upstash/redis";
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * Database Utility (Upstash Redis)
 * --------------------------------
 * This module provides functions to interact with Upstash Redis for token storage.
 * Tokens are encrypted at rest using AES-256-GCM derived from WEBFLOW_CLIENT_SECRET.
 *
 * Key structure:
 *   site:<siteId>  → encrypted access token
 *   user:<userId>  → encrypted access token
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.WEBFLOW_CLIENT_SECRET;
  if (!secret) {
    throw new Error("WEBFLOW_CLIENT_SECRET is required for token encryption");
  }
  return scryptSync(secret, "simple-analytics-salt", 32);
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(encoded: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** Singleton Redis client */
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  return redis;
}

/**
 * Stores a site authorization (siteId → accessToken).
 */
export async function insertSiteAuthorization(
  siteId: string,
  accessToken: string
) {
  const db = getRedis();
  const encryptedToken = encrypt(accessToken);
  await db.set(`site:${siteId}`, encryptedToken);
  console.log("Site authorization pairing updated.");
}

/**
 * Stores a user authorization (userId → accessToken).
 */
export async function insertUserAuthorization(
  userId: string,
  accessToken: string
) {
  const db = getRedis();
  const encryptedToken = encrypt(accessToken);
  await db.set(`user:${userId}`, encryptedToken);
  console.log("User access token pairing updated.");
}

/**
 * Retrieves the access token for a given site ID.
 */
export async function getAccessTokenFromSiteId(
  siteId: string
): Promise<string> {
  const db = getRedis();
  const encryptedToken = await db.get<string>(`site:${siteId}`);

  if (!encryptedToken) {
    throw new Error("No access token found or site does not exist");
  }

  return decrypt(encryptedToken);
}

/**
 * Retrieves the access token for a given user ID.
 */
export async function getAccessTokenFromUserId(
  userId: string
): Promise<string> {
  const db = getRedis();
  const encryptedToken = await db.get<string>(`user:${userId}`);

  if (!encryptedToken) {
    throw new Error("No access token found or user does not exist");
  }

  return decrypt(encryptedToken);
}

/**
 * Clears all data from the database.
 * Note: In production, this uses FLUSHDB which removes ALL keys.
 * Use with caution.
 */
export async function clearDatabase() {
  const db = getRedis();
  await db.flushdb();
  console.log("Database cleared successfully");
}

const database = {
  getAccessTokenFromSiteId,
  getAccessTokenFromUserId,
  insertSiteAuthorization,
  insertUserAuthorization,
  clearDatabase,
};

export default database;
