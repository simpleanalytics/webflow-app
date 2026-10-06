import { NextRequest, NextResponse } from "next/server";
import jwt from "../../../lib/utils/jwt";
import db from "../../../lib/utils/database";

export const dynamic = "force-dynamic";

/*
    Token Exchange API Route
    ----------------------
    This route handles user authentication by exchanging a Webflow ID token for a custom session token.
    
    Flow:
    1. Designer Extension (client) sends a POST request with:
       - Site ID
       - Webflow ID token
    
    2. Server performs these steps:
       a) Retrieves an Access Token using the Site ID
          - This Access Token proves that the site the request is coming from is authorized to access Webflow's API
       
       b) Verifies the User's ID Token with Webflow
          - Sends the ID token to Webflow's API, making an authenticated request with the retrieved Access Token
          - Receives user information if the token is valid
       
       c) Creates a database record in the UserAuth table
          - Stores the User ID and Access Token for future requests
       
       d) Issues a session token
          - Creates a JWT containing user information
          - Includes an expiration time for security
    
    3. Returns to client:
       - Session token
       - Expiration timestamp
    
    Error Handling:
    - Returns 401 if Site ID is invalid or unauthorized
    - Returns 401 if user verification fails
*/
export async function POST(request: NextRequest) {
  // Clone the request since we need to read the body twice
  const clonedRequest = request.clone() as NextRequest;

  // Get the Access Token for the Site ID
  const accessToken = await jwt.getAccessToken(clonedRequest);

  // If the Access Token is not found, return a 401 Unauthorized response
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the ID Token from the request body
    const body = await request.json();
    const token = body.idToken;

    // Verify the ID Token with Webflow's API
    const response = await fetch("https://api.webflow.com/beta/token/resolve", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // This Access Token proves the site the request is coming from is authorized to access Webflow's API
      },
      body: JSON.stringify({
        idToken: token,
      }),
    });

    // Validate the response from Webflow
    if (!response.ok) {
      console.error("Webflow token resolve failed:", response.status);
      return NextResponse.json(
        { error: "Failed to verify ID token with Webflow" },
        { status: 401 }
      );
    }

    // Get the user information from the response
    const user = await response.json();
    console.log("User:", user);

    // Generate a Session Token
    const tokenPayload = await jwt.createSessionToken(user);
    const sessionToken = tokenPayload.sessionToken;
    const expAt = tokenPayload.exp;

    // Store the User ID and Access Token in the database
    await db.insertUserAuthorization(user.id, accessToken);

    // Return the Session Token and Expiration Time to the Designer Extension (client)
    return NextResponse.json({ sessionToken, exp: expAt });
  } catch (e) {
    // If the user is not associated with the site, return a 401 Unauthorized response
    console.error("Unauthorized user", e);
    return NextResponse.json(
      {
        error: "Error: User is not associated with authorization for this site",
      },
      { status: 401 }
    );
  }
}
