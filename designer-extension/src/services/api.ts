import { ScriptConfig, RegisteredScript, ScriptStatus } from "../types/types";

const BASE_URL = import.meta.env.VITE_DATA_CLIENT_URL;
const TIMEOUT_MS = 30_000;

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}

/** POST /api/scripts/register - register an inline script with Webflow */
export async function registerScript(
  siteId: string,
  config: ScriptConfig,
  token: string
): Promise<RegisteredScript> {
  const response = await fetchWithTimeout(`${BASE_URL}/api/scripts/register`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ siteId, config }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to register script");
  }

  return response.json();
}

/** POST /api/scripts/apply - apply a registered script to a site header */
export async function applyScript(
  siteId: string,
  scriptId: string,
  version: string,
  token: string
): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/api/scripts/apply`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ siteId, scriptId, version }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to apply script");
  }
}

/** GET /api/scripts/status - check if script is installed on site */
export async function checkScriptStatus(
  siteId: string,
  token: string
): Promise<ScriptStatus> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/api/scripts/status?siteId=${encodeURIComponent(siteId)}`,
    {
      method: "GET",
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to check script status");
  }

  return response.json();
}

/** POST /api/scripts/remove - remove script from site */
export async function removeScript(
  siteId: string,
  token: string
): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/api/scripts/remove`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ siteId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to remove script");
  }
}

/** POST /api/auth/disconnect - remove app data and authorization for this site */
export async function disconnectWebflow(
  siteId: string,
  token: string
): Promise<void> {
  const response = await fetchWithTimeout(`${BASE_URL}/api/auth/disconnect`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ siteId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to disconnect Webflow");
  }
}
