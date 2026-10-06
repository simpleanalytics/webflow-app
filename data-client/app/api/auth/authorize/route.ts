import { WebflowClient } from "webflow-api";
import { NextResponse } from "next/server";
import { OauthScope } from "webflow-api/api/types/OAuthScope";

export const dynamic = "force-dynamic";

/**
 * Authorize API Route Handler
 * --------------------------
 * Returns the Webflow OAuth URL as JSON when ?json=true is set (for popup flows),
 * otherwise redirects directly (for direct navigation).
 */

const scopes = [
  "sites:read",
  "custom_code:read",
  "custom_code:write",
  "authorized_user:read",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isDesigner = searchParams.get("state") === "webflow_designer";

  const authorizeUrl = WebflowClient.authorizeURL({
    scope: scopes as OauthScope[],
    clientId: process.env.WEBFLOW_CLIENT_ID!,
    state: isDesigner ? "webflow_designer" : undefined,
  });

  // Return URL as JSON for client-side navigation (avoids bot detection on server redirect)
  if (searchParams.get("json") === "true") {
    return NextResponse.json({ url: authorizeUrl });
  }

  return NextResponse.redirect(authorizeUrl);
}
