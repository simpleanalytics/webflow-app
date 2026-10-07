import { NextResponse } from "next/server";
import { getRedis } from "../../lib/utils/database";
import { requiredEnv, appOrigin, extensionOrigin } from "../../lib/utils/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requiredEnv("WEBFLOW_CLIENT_ID");
    requiredEnv("WEBFLOW_CLIENT_SECRET");
    appOrigin();
    extensionOrigin();
    await (await getRedis()).ping();
    return NextResponse.json({ status: "healthy" });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
