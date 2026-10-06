import { WebflowClient } from "webflow-api";

const SCRIPT_DISPLAY_NAME = "Simple Analytics";

/**
 * Increment a semver version string (e.g., "1.0.0" -> "1.0.1").
 */
function incrementVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join(".");
}

interface RegisterResult {
  id: string;
  version: string;
  updated: boolean;
}

/**
 * Register an inline script for a site.
 * If a script with the same display name already exists, auto-increments the version.
 */
export async function registerInlineScript(
  webflow: WebflowClient,
  siteId: string,
  sourceCode: string
): Promise<RegisterResult> {
  // Check for existing scripts with the same name
  const existingScripts = await webflow.scripts.list(siteId);
  const matching = (existingScripts.registeredScripts || [])
    .filter((s) => s.displayName === SCRIPT_DISPLAY_NAME)
    .sort((a, b) =>
      (b.version ?? "0.0.0").localeCompare(a.version ?? "0.0.0", undefined, {
        numeric: true,
      })
    );

  let newVersion = "1.0.0";
  let isUpdate = false;

  if (matching.length > 0) {
    const latest = matching[0];
    newVersion = incrementVersion(latest.version ?? "1.0.0");
    isUpdate = true;
  }

  const script = await webflow.scripts.registerInline(siteId, {
    displayName: SCRIPT_DISPLAY_NAME,
    sourceCode,
    version: newVersion,
    canCopy: true,
  });

  return {
    id: script.id!,
    version: newVersion,
    updated: isUpdate,
  };
}

/**
 * Apply a registered script to a site's header via upsertCustomCode.
 */
export async function applySiteScript(
  webflow: WebflowClient,
  siteId: string,
  scriptId: string,
  version: string
): Promise<void> {
  await webflow.sites.scripts.upsertCustomCode(siteId, {
    scripts: [
      {
        id: scriptId,
        location: "header",
        version,
      },
    ],
  });
}

interface ScriptStatus {
  installed: boolean;
  version?: string;
  duplicateDetected: boolean;
}

/**
 * Check if a Simple Analytics script is already registered for a site,
 * and detect duplicate SA scripts (e.g. manually added via Project Settings).
 */
export async function checkScriptStatus(
  webflow: WebflowClient,
  siteId: string
): Promise<ScriptStatus> {
  // Check registered scripts from our app
  const existingScripts = await webflow.scripts.list(siteId);
  const matching = (existingScripts.registeredScripts || [])
    .filter((s) => s.displayName === SCRIPT_DISPLAY_NAME)
    .sort((a, b) =>
      (b.version ?? "0.0.0").localeCompare(a.version ?? "0.0.0", undefined, {
        numeric: true,
      })
    );

  const customCode = await webflow.sites.scripts.getCustomCode(siteId);
  const applied = customCode?.scripts || [];
  const installedScript = applied.find(script => matching.some(registered => registered.id === script.id));
  const installed = Boolean(installedScript);
  const version = installedScript?.version;

  // Check for duplicate SA scripts on the site (e.g. manually added)
  let duplicateDetected = false;
  try {
    const scripts = applied;

    // Count how many applied scripts reference simpleanalyticscdn in their source
    // Our app registers scripts with displayName "Simple Analytics",
    // so any OTHER script pointing to simpleanalyticscdn.com is a duplicate
    const ourScriptIds = new Set(matching.map((s) => s.id));
    const otherSAScripts = scripts.filter((s: { id?: string }) => {
      // If this script is one of ours, skip it
      if (s.id && ourScriptIds.has(s.id)) return false;

      // Check registered scripts list for source URL
      const registered = (existingScripts.registeredScripts || []).find(
        (r) => r.id === s.id
      );
      const reg = registered as Record<string, unknown> | undefined;
      if (typeof reg?.sourceUrl === "string" && reg.sourceUrl.includes("simpleanalyticscdn.com")) return true;
      if (typeof reg?.source === "string" && reg.source.includes("simpleanalyticscdn.com")) return true;

      return false;
    });

    duplicateDetected = otherSAScripts.length > 0;
  } catch {
    // getCustomCode may fail if no custom code exists yet — that's fine
  }

  return { installed, version, duplicateDetected };
}

/**
 * Remove all scripts applied by our app from the site.
 */
export async function removeSiteScript(
  webflow: WebflowClient,
  siteId: string
): Promise<void> {
  await webflow.sites.scripts.deleteCustomCode(siteId);
}
