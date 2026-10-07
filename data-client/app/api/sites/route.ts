import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../lib/utils/jwt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = /^Bearer ([^ ]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) throw new Error("Unauthorized");
    const { siteId } = await jwt.verifySession(token);
    const accessToken = await jwt.verifyAuth(request, siteId);
    if (!accessToken) throw new Error("Unauthorized");
    const site = await new WebflowClient({ accessToken }).sites.get(siteId);
    return NextResponse.json({ data: { sites: [site] } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
