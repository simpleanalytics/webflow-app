import { NextRequest, NextResponse } from "next/server";
import jwt from "../../../lib/utils/jwt";
import db from "../../../lib/utils/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { siteId, idToken } = body ?? {};
  if (typeof siteId !== "string" || !siteId || typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "siteId and idToken are required" }, { status: 400 });
  }
  try {
    const accessToken = await db.getAccessTokenFromSiteId(siteId);
    const response = await fetch("https://api.webflow.com/beta/token/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const user = await response.json();
      // A valid Designer token for another site must never authorize this site.
      if (typeof user.id === "string" && user.id && user.siteId === siteId) {
        return NextResponse.json(await jwt.createSessionToken(user.id, siteId));
      }
    }
  } catch {
    // Do not expose upstream tokens, personal data or connection details.
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
