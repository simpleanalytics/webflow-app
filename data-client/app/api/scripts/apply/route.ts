import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../../lib/utils/jwt";
import { applySiteScript } from "../../../lib/controllers/scriptController";

export const dynamic = "force-dynamic";

/**
 * POST /api/scripts/apply
 *
 * Accepts { siteId, scriptId, version }.
 * Applies the registered script to the site header via upsertCustomCode.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, scriptId, version } = body as {
      siteId: string;
      scriptId: string;
      version: string;
    };

    if (!siteId || !scriptId || !version) {
      return NextResponse.json(
        { error: "siteId, scriptId, and version are required" },
        { status: 400 }
      );
    }

    const accessToken = await jwt.verifyAuth(request, siteId);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webflow = new WebflowClient({ accessToken });
    await applySiteScript(webflow, siteId, scriptId, version);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to apply script" },
      { status: 500 }
    );
  }
}
