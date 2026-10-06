import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Quick health check that tests Redis connectivity and env var presence.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars (existence only, not values)
  checks.WEBFLOW_CLIENT_ID = process.env.WEBFLOW_CLIENT_ID ? "set" : "MISSING";
  checks.WEBFLOW_CLIENT_SECRET = process.env.WEBFLOW_CLIENT_SECRET ? "set" : "MISSING";
  checks.KV_REST_API_URL = process.env.KV_REST_API_URL ? "set" : "MISSING";
  checks.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN ? "set" : "MISSING";
  checks.DESIGNER_EXTENSION_URI = process.env.DESIGNER_EXTENSION_URI || "not set (using default)";

  // Test Redis connection
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const redis = new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      await redis.ping();
      checks.redis_connection = "OK";
    } else {
      checks.redis_connection = "SKIPPED (missing credentials)";
    }
  } catch (error) {
    checks.redis_connection = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
  }

  const allGood = checks.WEBFLOW_CLIENT_ID === "set" &&
    checks.WEBFLOW_CLIENT_SECRET === "set" &&
    checks.KV_REST_API_URL === "set" &&
    checks.KV_REST_API_TOKEN === "set" &&
    checks.redis_connection === "OK";

  return NextResponse.json({
    status: allGood ? "healthy" : "unhealthy",
    checks,
  });
}
