import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3039";
const origin = "https://smoke-test.webflow-ext.com";
const request = (path, options) => fetch(base + path, { signal: AbortSignal.timeout(5000), ...options });

if (process.argv.includes("--unhealthy")) {
  const response = await request("/api/health");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unhealthy" });
} else {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "healthy" });
  for (const action of ["register", "apply", "remove"]) {
    const response = await request(`/api/scripts/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: "test-site", scriptId: "test-script", version: "1.0.0" }) });
    assert.equal(response.status, 401);
  }
  for (const path of ["/api/sites", "/api/scripts/status?siteId=test-site"]) {
    assert.equal((await request(path)).status, 401);
  }
  const preflight = await request("/api/scripts/apply", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  const denied = await request("/api/scripts/apply", { method: "OPTIONS", headers: { Origin: "https://untrusted.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  const auth = await request("/api/auth/authorize?popup=true", { redirect: "manual" });
  assert.equal(auth.status, 307);
  const url = new URL(auth.headers.get("location"));
  assert.equal(url.origin, "https://webflow.com");
  assert.match(url.searchParams.get("state"), /^[a-f0-9]{64}$/);
  assert.match(auth.headers.get("set-cookie"), /HttpOnly/i);
  const callback = await request(`/api/auth/callback?code=test&state=${url.searchParams.get("state")}`);
  assert.equal(callback.status, 400);
}
console.log("Backend smoke checks passed");
