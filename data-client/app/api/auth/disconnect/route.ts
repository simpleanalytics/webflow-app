import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../../lib/utils/jwt";
import db from "../../../lib/utils/database";
import { requiredEnv } from "../../../lib/utils/config";
import { removeSiteScript } from "../../../lib/controllers/scriptController";

export const dynamic = "force-dynamic";

export async function revokeAuthorization(accessToken: string): Promise<void> {
  const response = await fetch("https://webflow.com/oauth/revoke_authorization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requiredEnv("WEBFLOW_CLIENT_ID"),
      client_secret: requiredEnv("WEBFLOW_CLIENT_SECRET"),
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Webflow authorization revocation failed");
}

/**
 * POST /api/auth/disconnect
 *
 * Removes the app's custom code and stored authorization for one site. A
 * shared Webflow grant is revoked only when no other site uses it.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const siteId = (body as { siteId?: unknown } | null)?.siteId;
  if (typeof siteId !== "string" || !siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  const accessToken = await jwt.verifyAuth(request, siteId);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const webflow = new WebflowClient({ accessToken });
    await removeSiteScript(webflow, siteId);
    const remainingSites = await db.removeSiteAuthorization(siteId, accessToken);

    if (remainingSites === 0) {
      try {
        await revokeAuthorization(accessToken);
      } catch {
        // Keep the local authorization usable so the user can retry cleanup.
        await db.insertSiteAuthorization(siteId, accessToken);
        return NextResponse.json(
          { error: "Webflow could not be disconnected. Please try again." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to disconnect Webflow" },
      { status: 500 }
    );
  }
}
