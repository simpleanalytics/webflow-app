import { NextRequest, NextResponse } from "next/server";
import { WebflowClient } from "webflow-api";
import jwt from "../../lib/utils/jwt";

export const dynamic = "force-dynamic";

/*
    Sites API Route
    ---------------
    This route handles the GET request from the client to retrieve the list of sites associated with the user.
*/
export async function GET(request: NextRequest) {
  try {
    // Clone the request since we need to read the body twice
    const clonedRequest = request.clone() as NextRequest;

    // Verify the user is authenticated
    const accessToken = await jwt.verifyAuth(clonedRequest);

    // If the user is not authenticated, return a 401 Unauthorized response
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a new WebflowClient with the Access Token
    const webflow = new WebflowClient({ accessToken });

    // Get the list of sites associated with the user
    const data = await webflow.sites.list();

    // Return the list of sites to the client
    return NextResponse.json({ data });
  } catch (error) {
    // If an error occurs, return a 500 Internal Server Error response
    console.error("Error handling authenticated request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
