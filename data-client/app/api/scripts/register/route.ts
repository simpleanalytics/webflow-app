import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../../lib/utils/jwt";
import { generateScript, ScriptConfig } from "../../../lib/utils/scriptGenerator";
import { registerInlineScript } from "../../../lib/controllers/scriptController";

export const dynamic = "force-dynamic";

/**
 * POST /api/scripts/register
 *
 * Accepts { siteId, config } where config has trackPageviews, trackEvents, collectDNT.
 * Generates the inline script and registers it with Webflow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, config } = body as { siteId: string; config: ScriptConfig };

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const accessToken = await jwt.verifyAuth(request, siteId);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sourceCode = generateScript(config);
    const webflow = new WebflowClient({ accessToken });
    const result = await registerInlineScript(webflow, siteId, sourceCode);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to register script" },
      { status: 500 }
    );
  }
}
