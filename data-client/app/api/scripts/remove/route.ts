import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../../lib/utils/jwt";
import { removeSiteScript } from "../../../lib/controllers/scriptController";

export const dynamic = "force-dynamic";

/**
 * POST /api/scripts/remove
 *
 * Accepts { siteId }.
 * Removes all scripts applied by our app from the site.
 */
export async function POST(request: NextRequest) {
  const clonedRequest = request.clone() as NextRequest;
  const accessToken = await jwt.verifyAuth(clonedRequest);

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { siteId } = body as { siteId: string };

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const webflow = new WebflowClient({ accessToken });
    await removeSiteScript(webflow, siteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in /api/scripts/remove:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove script" },
      { status: 500 }
    );
  }
}
