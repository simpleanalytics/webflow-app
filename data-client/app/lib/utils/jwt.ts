import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import db from "./database";
import { requiredEnv } from "./config";

const issuer = "simpleanalytics-webflow";
const audience = "webflow-designer";
const secret = () => new TextEncoder().encode(requiredEnv("WEBFLOW_CLIENT_SECRET"));

export async function createSessionToken(userId: string, siteId: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sessionToken = await new SignJWT({ siteId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret());
  return { sessionToken, exp };
}

export async function verifySession(sessionToken: string) {
  const { payload } = await jwtVerify(sessionToken, secret(), {
    algorithms: ["HS256"], issuer, audience, requiredClaims: ["exp", "sub", "siteId"],
  });
  if (typeof payload.siteId !== "string" || !payload.siteId || !payload.sub) {
    throw new Error("Invalid session");
  }
  return { siteId: payload.siteId, userId: payload.sub };
}

export async function verifyAuth(request: NextRequest, siteId: unknown) {
  const match = /^Bearer ([^ ]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || typeof siteId !== "string" || !siteId) return null;
  try {
    const session = await verifySession(match[1]);
    if (session.siteId !== siteId) return null;
    return await db.getAccessTokenFromSiteId(siteId);
  } catch {
    return null;
  }
}

export default { createSessionToken, verifyAuth, verifySession };
