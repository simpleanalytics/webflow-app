import { Webflow, WebflowClient } from "webflow-api";

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
}

/**
 * Check if a Simple Analytics script registered by this app is applied to a site.
 * Webflow does not expose custom code owned by other apps or added manually.
 */
export async function checkScriptStatus(
  webflow: WebflowClient,
  siteId: string
): Promise<ScriptStatus> {
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

  return { installed, version };
}

/**
 * Remove all scripts applied by our app from the site.
 */
export async function removeSiteScript(
  webflow: WebflowClient,
  siteId: string
): Promise<void> {
  try {
    await webflow.sites.scripts.deleteCustomCode(siteId);
  } catch (error) {
    // Disconnect is idempotent when the app has no custom code on the site.
    if (!(error instanceof Webflow.NotFoundError)) throw error;
  }
}
