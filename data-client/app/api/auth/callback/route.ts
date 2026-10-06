import { timingSafeEqual } from "node:crypto";
import { WebflowClient } from "webflow-api";
import { NextRequest, NextResponse } from "next/server";
import db, { getRedis } from "../../../lib/utils/database";
import { extensionOrigin, requiredEnv } from "../../../lib/utils/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const cookie = request.cookies.get("webflow_oauth_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !state || !cookie || !/^[a-f0-9]{64}$/.test(state) ||
      !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
    return NextResponse.json({ error: "Invalid authorization state. Please connect again." }, { status: 400 });
  }
  try {
    // Consume the nonce before exchange so callbacks cannot be replayed.
    const saved = await (await getRedis()).getDel(`oauth:${state}`);
    if (!saved) return NextResponse.json({ error: "Authorization expired. Please connect again." }, { status: 400 });
    const { popup } = JSON.parse(saved);
    const accessToken = await WebflowClient.getAccessToken({
      clientId: requiredEnv("WEBFLOW_CLIENT_ID"),
      clientSecret: requiredEnv("WEBFLOW_CLIENT_SECRET"), code,
    });
    const webflow = new WebflowClient({ accessToken });
    const { sites = [] } = await webflow.sites.list();
    await Promise.all(sites.map(site => db.insertSiteAuthorization(site.id, accessToken)));

    let response: NextResponse;
    if (popup) {
      const origin = JSON.stringify(extensionOrigin()).replace(/</g, "\\u003c");
      response = new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8">
        <title>Connected to Webflow</title><p>Connected. You can close this window and return to Webflow.</p>
        <script>if(window.opener)window.opener.postMessage("authComplete",${origin});window.close();</script></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } else {
      const destination = sites[0]
        ? `https://${sites[0].shortName}.design.webflow.com?app=${encodeURIComponent(requiredEnv("WEBFLOW_CLIENT_ID"))}`
        : "https://webflow.com/dashboard";
      response = NextResponse.redirect(destination);
    }
    response.cookies.set("webflow_oauth_state", "", { path: "/api/auth", maxAge: 0 });
    return response;
  } catch {
    console.error("Webflow authorization failed");
    return NextResponse.json({ error: "Authorization failed. Please connect again." }, { status: 502 });
  }
}
