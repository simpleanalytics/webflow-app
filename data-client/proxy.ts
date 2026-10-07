import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.DESIGNER_EXTENSION_URI;
  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: origin === allowedOrigin ? 204 : 403 })
    : NextResponse.next();
  response.headers.set("Vary", "Origin");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (origin && origin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return response;
}

export const config = { matcher: "/api/:path*" };
