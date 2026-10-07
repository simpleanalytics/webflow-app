import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { WebflowClient } from "webflow-api";
import db, { encrypt, decrypt } from "../app/lib/utils/database";
import jwt from "../app/lib/utils/jwt";
import { POST as exchange } from "../app/api/auth/token/route";
import { GET as callback, exchangeAuthorizationCode } from "../app/api/auth/callback/route";
import { revokeAuthorization } from "../app/api/auth/disconnect/route";
import { generateScript, type ScriptConfig } from "../app/lib/utils/scriptGenerator";
import { checkScriptStatus } from "../app/lib/controllers/scriptController";

process.env.WEBFLOW_CLIENT_SECRET = "local-test-secret-not-used-in-production";
process.env.WEBFLOW_CLIENT_ID = "local-test-client";
process.env.APP_BASE_URL = "https://webflow-app.example";
afterEach(() => mock.restoreAll());

test("tokens are encrypted with random IVs and reject tampering", () => {
  const token = "test-oauth-token";
  const encrypted = encrypt(token);
  assert.equal(decrypt(encrypted), token);
  assert.notEqual(encrypted, encrypt(token));
  assert.ok(!encrypted.includes(token));
  const parts = encrypted.split(":");
  parts[1] = "00".repeat(16);
  assert.throws(() => decrypt(parts.join(":")));
});

test("sessions can only retrieve their own site's token", async () => {
  const get = mock.method(db, "getAccessTokenFromSiteId", async () => "access-token");
  const { sessionToken } = await jwt.createSessionToken("user-a", "site-a");
  const request = new NextRequest("http://localhost/api/scripts/remove", { headers: { Authorization: `Bearer ${sessionToken}` } });
  assert.equal(await jwt.verifyAuth(request, "site-b"), null);
  assert.equal(get.mock.callCount(), 0);
  assert.equal(await jwt.verifyAuth(request, "site-a"), "access-token");
  assert.equal(get.mock.calls[0].arguments[0], "site-a");
});

test("expired and incorrectly signed sessions are rejected", async () => {
  for (const secret of [process.env.WEBFLOW_CLIENT_SECRET!, "wrong-secret"]) {
    const token = await new SignJWT({ siteId: "site-a" }).setProtectedHeader({ alg: "HS256" })
      .setSubject("user-a").setIssuer("simpleanalytics-webflow").setAudience("webflow-designer")
      .setExpirationTime(secret === "wrong-secret" ? "1h" : 1)
      .sign(new TextEncoder().encode(secret));
    await assert.rejects(jwt.verifySession(token));
  }
});

test("token exchange checks the site returned by Webflow and omits personal data", async () => {
  mock.method(db, "getAccessTokenFromSiteId", async () => "access-token");
  const fetchMock = mock.method(globalThis, "fetch", async () => Response.json({ id: "user-a", siteId: "site-b", email: "private@example.invalid" }));
  const request = () => new NextRequest("http://localhost/api/auth/token", { method: "POST", body: JSON.stringify({ siteId: "site-a", idToken: "id-token" }) });
  assert.equal((await exchange(request())).status, 401);
  fetchMock.mock.mockImplementation(async () => Response.json({ id: "user-a", siteId: "site-a", email: "private@example.invalid" }));
  const response = await exchange(request());
  assert.equal(response.status, 200);
  const { sessionToken } = await response.json();
  assert.deepEqual(await jwt.verifySession(sessionToken), { userId: "user-a", siteId: "site-a" });
  assert.ok(!Buffer.from(sessionToken.split(".")[1], "base64url").toString().includes("email"));
});

test("OAuth rejects callbacks without a matching browser nonce before token exchange", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("Must not exchange"); });
  for (const cookie of ["", "webflow_oauth_state=" + "b".repeat(64)]) {
    const request = new NextRequest(`http://localhost/api/auth/callback?code=example&state=${"a".repeat(64)}`, { headers: { cookie } });
    assert.equal((await callback(request)).status, 400);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("OAuth token exchange repeats the exact configured callback URI", async () => {
  const getAccessToken = mock.method(WebflowClient, "getAccessToken", async () => "access-token");
  assert.equal(await exchangeAuthorizationCode("authorization-code"), "access-token");
  assert.deepEqual(getAccessToken.mock.calls[0].arguments[0], {
    clientId: "local-test-client",
    clientSecret: "local-test-secret-not-used-in-production",
    redirectUri: "https://webflow-app.example/api/auth/callback",
    code: "authorization-code",
  });
});

test("Webflow revocation sends the grant only to the official endpoint", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(null, { status: 200 }));
  await revokeAuthorization("access-token");
  assert.equal(fetchMock.mock.calls[0].arguments[0], "https://webflow.com/oauth/revoke_authorization");
  const options = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(options.method, "POST");
  assert.deepEqual(JSON.parse(options.body as string), {
    client_id: "local-test-client",
    client_secret: "local-test-secret-not-used-in-production",
    access_token: "access-token",
  });
});

const config: ScriptConfig = {
  trackPageviews: true, trackEvents: false, collectDNT: false, automatedEvents: true,
  hashMode: false, ignorePages: "", customDomain: "", overwriteDomain: "",
  collectOutbound: false, collectEmails: false, collectDownloads: false,
  downloadExtensions: "", usePageTitle: true, collectFullUrls: false, collectLinkEvents: false,
};

test("script settings are serialized safely and disabled event types stay disabled", () => {
  const scripts: Array<{ src: string; dataset: Record<string, string> }> = [];
  const value = '";globalThis.injected=true;//</script>';
  const source = generateScript({ ...config, ignorePages: value });
  const context = { document: { createElement: () => ({ dataset: {} }), head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) } } };
  runInNewContext(source, context);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].dataset.ignorePages, value);
  assert.ok(!source.includes("</script>"));
  assert.ok(!("injected" in context));
  assert.throws(() => generateScript({ ...config, customDomain: 'example.com/path' }));
});

test("a registered script is not installed after it has been removed", async () => {
  const webflow = { scripts: { list: async () => ({ registeredScripts: [{ id: "sa", displayName: "Simple Analytics", version: "1.0.0" }] }) }, sites: { scripts: { getCustomCode: async () => ({ scripts: [] }) } } } as unknown as WebflowClient;
  assert.deepEqual(await checkScriptStatus(webflow, "site-a"), { installed: false, version: undefined });
});
