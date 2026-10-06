import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import db from "./database";

/*
  JWT Utility Functions
  ---------------------
  This file provides a comprehensive set of utilities for handling JSON Web Tokens (JWT) 
  in a Next.js application. It manages authentication between Webflow's Designer Extension 
  and our backend API.

  Architecture:
  - Uses JOSE library for JWT operations
  - Implements HS256 algorithm for token signing
  - Stores access tokens in database
  - Handles token verification and extraction

  Security:
  - Tokens expire after 24 hours
  - Uses WEBFLOW_CLIENT_SECRET for signing
  - Validates signatures on every request
  - Safely handles verification failures
*/

interface User {
  id: string;
  email: string;
}

interface JWTPayload {
  user: User;
}

/**
 * Creates a signed JWT session token for authenticated users
 *
 * @param user - Object containing user ID and email
 * @returns Promise containing:
 *   - sessionToken: Signed JWT token
 *   - exp: Token expiration timestamp
 *
 * Flow:
 * 1. Encodes signing secret
 * 2. Creates and signs token with 24h expiration
 * 3. Verifies token and extracts expiration
 */
const createSessionToken = async (user: User) => {
  // Encode secret
  const secret = new TextEncoder().encode(process.env.WEBFLOW_CLIENT_SECRET);

  // Create session token
  const sessionToken = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret);

  // Decode token
  const decodedToken = await jwtVerify(sessionToken, secret);

  return {
    sessionToken,
    exp: decodedToken.payload.exp,
  };
};

/**
 * Validates JWT token from request and retrieves associated access token
 *
 * @param request - Incoming Next.js request
 * @returns Promise<string | null> - Access token if valid, null otherwise
 *
 * Flow:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies token signature and expiration
 * 3. Retrieves associated access token from database
 * 4. Returns null if any step fails
 */
const verifyAuth = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization"); // Get authorization header from request
  const sessionToken = authHeader?.split(" ")[1]; // Extract the token from 'Bearer <token>'

  // If no session token, return null
  if (!sessionToken) {
    return null;
  }

  try {
    // Verify session token
    const secret = new TextEncoder().encode(process.env.WEBFLOW_CLIENT_SECRET);
    const { payload } = (await jwtVerify(sessionToken, secret)) as {
      payload: JWTPayload;
    };

    // Get user ID from payload
    const userId = payload.user.id;

    // Get access token from user ID
    const accessToken = await db.getAccessTokenFromUserId(userId as string);

    // Return access token
    return accessToken;
  } catch {
    // If error, return null
    return null;
  }
};

/**
 * Retrieves Webflow access token for a specific site
 *
 * @param request - Incoming request containing siteId in body
 * @returns Promise<string | null> - Access token if found, null otherwise
 *
 * Flow:
 * 1. Extracts siteId from request body
 * 2. Looks up access token in database
 * 3. Handles errors and missing tokens
 */
const getAccessToken = async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { siteId } = body;

    // Get the access token from your database or wherever you store it
    const accessToken = await db.getAccessTokenFromSiteId(siteId);

    if (!accessToken) {
      console.error(`No access token found for site ${siteId}`);
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
};

const jwtUtils = {
  createSessionToken,
  verifyAuth,
  getAccessToken,
};

export default jwtUtils;
