import { WebflowClient } from "webflow-api";
import { NextRequest, NextResponse } from "next/server";
import db from "../../../lib/utils/database";

export const dynamic = "force-dynamic";

/**
 * Callback API Route Handler
 * -------------------------
 * This route processes the OAuth callback from Webflow after a user authorizes the application.
 *
 * Flow:
 * 1. Receives authorization code from Webflow
 * 2. Exchanges code for access token
 * 3. Retrieves user's Webflow sites
 * 4. Stores site authorization details
 * 5. Handles response based on access method (popup vs direct)
 *
 * @param {NextRequest} request - The incoming request object containing:
 *   - searchParams: URL parameters including the authorization 'code'
 *   - headers: Request headers to determine if accessed via popup
 *
 * @returns {Promise<NextResponse>}
 *   - For popup windows: Returns HTML to close window and notify parent
 *   - For direct navigation: Redirects to the first authorized Webflow site
 *   - On error: Returns 400 status if no code provided
 *
 * @requires {WEBFLOW_CLIENT_ID} - Environment variable for OAuth client ID
 * @requires {WEBFLOW_CLIENT_SECRET} - Environment variable for OAuth client secret
 */
export async function GET(request: NextRequest) {
  // Get the authorization code from the request
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  // If no code, return a 400 error
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    // Get Access Token
    const accessToken = await WebflowClient.getAccessToken({
      clientId: process.env.WEBFLOW_CLIENT_ID!,
      clientSecret: process.env.WEBFLOW_CLIENT_SECRET!,
      code: code,
    });

    // Instantiate the Webflow Client
    const webflow = new WebflowClient({ accessToken });

    // Get Site ID to pair with the access token
    const sites = await webflow.sites.list();
    const authInfo = await webflow.token.introspect();

    // Store site authorizations in parallel
    const siteList = sites?.sites ?? [];
    if (siteList.length > 0) {
      await Promise.all(
        siteList.map((site) => db.insertSiteAuthorization(site.id, accessToken))
      );
    }

    // Check if the authorization request came from our Webflow designer extension
    const isAppPopup = searchParams.get("state") === "webflow_designer";
    console.log("isAppPopup", isAppPopup);

    // If the request is from a popup window, return HTML to close the window
    const extensionOrigin = process.env.DESIGNER_EXTENSION_URI || "*";
    if (isAppPopup) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Authorization Complete</title>
          </head>
          <body>
            <p>Authorization complete! This window will close automatically.</p>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage('authComplete', '${extensionOrigin}');
                }
              } catch (e) {
                console.log('postMessage failed (expected in cross-origin)', e);
              }
              window.close();
              // If window.close() doesn't work (not opened by script),
              // show a message so the user knows to close manually
              setTimeout(function() {
                document.body.innerHTML = '<p style="font-family:sans-serif;text-align:center;margin-top:40px;">Authorization successful! You can close this tab and return to the Webflow Designer.</p>';
              }, 500);
            </script>
          </body>
        </html>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    } else {
      // If authorized to the Workspace - redirect to the Dashboard
      const workspaceIds =
        authInfo?.authorization?.authorizedTo?.workspaceIds ?? [];
      if (workspaceIds.length > 0) {
        return NextResponse.redirect(
          `https://webflow.com/dashboard?workspace=${workspaceIds[0]}`
        );
      } else {
        // If authorized to the Site - redirect to the Designer Extension
        const firstSite = siteList[0];
        if (firstSite) {
          return NextResponse.redirect(
            `https://${firstSite.shortName}.design.webflow.com?app=${process.env.WEBFLOW_CLIENT_ID}`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error in callback:", error);
    return NextResponse.json(
      { error: "Failed to process authorization" },
      { status: 500 }
    );
  }
}
