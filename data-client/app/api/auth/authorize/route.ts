import { randomBytes } from "node:crypto";
import { WebflowClient } from "webflow-api";
import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "../../../lib/utils/database";
import { appOrigin, requiredEnv } from "../../../lib/utils/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const state = randomBytes(32).toString("hex");
    const popup = request.nextUrl.searchParams.get("popup") === "true";
    await (await getRedis()).set(`oauth:${state}`, JSON.stringify({ popup }), { EX: 600 });
    const url = WebflowClient.authorizeURL({
      clientId: requiredEnv("WEBFLOW_CLIENT_ID"),
      redirectUri: `${appOrigin()}/api/auth/callback`,
      scope: ["sites:read", "custom_code:read", "custom_code:write", "authorized_user:read"],
      state,
    });
    const response = NextResponse.redirect(url);
    response.cookies.set("webflow_oauth_state", state, {
      httpOnly: true, secure: appOrigin().startsWith("https:"), sameSite: "lax",
      path: "/api/auth", maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Authorization is temporarily unavailable" }, { status: 503 });
  }
}
