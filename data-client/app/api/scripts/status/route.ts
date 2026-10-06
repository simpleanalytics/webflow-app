import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../../lib/utils/jwt";
import { checkScriptStatus } from "../../../lib/controllers/scriptController";

export const dynamic = "force-dynamic";

/**
 * GET /api/scripts/status?siteId=...
 *
 * Checks if a Simple Analytics script is currently applied to the site.
 * Returns { installed: boolean, version?: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const accessToken = await jwt.verifyAuth(request, siteId);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webflow = new WebflowClient({ accessToken });
    const status = await checkScriptStatus(webflow, siteId);

    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Failed to check script status" },
      { status: 500 }
    );
  }
}
