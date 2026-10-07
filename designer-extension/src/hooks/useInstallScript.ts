import { useState, useEffect } from "react";
import { ScriptConfig, StatusInfo } from "../types/types";
import {
  registerScript,
  applyScript,
  checkScriptStatus,
  removeScript,
} from "../services/api";

/**
 * Hook that handles install, update, and uninstall flows for the Simple Analytics script.
 */
export function useInstallScript(
  siteId: string | null,
  sessionToken: string
) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [scriptVersion, setScriptVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusInfo>({ message: "", type: "" });

  // Check install status on mount
  useEffect(() => {
    if (!siteId || !sessionToken) {
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const result = await checkScriptStatus(siteId!, sessionToken);
        if (!cancelled) {
          setIsInstalled(result.installed);
          setScriptVersion(result.version ?? null);
        }
      } catch {
        // Silent fail — default to not installed
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [siteId, sessionToken]);

  async function install(config: ScriptConfig) {
    if (!siteId) {
      setStatus({
        message: "Could not detect site. Open this app from the Webflow Designer.",
        type: "error",
      });
      return;
    }

    setIsInstalling(true);
    setStatus({ message: "Registering script...", type: "info" });

    try {
      const result = await registerScript(siteId, config, sessionToken);

      setStatus({ message: "Applying to site...", type: "info" });

      await applyScript(siteId, result.id, result.version, sessionToken);

      setIsInstalled(true);
      setScriptVersion(result.version);

      if (result.updated) {
        setStatus({
          message: `Script updated to v${result.version}! Publish your site to activate changes.`,
          type: "success",
        });
      } else {
        setStatus({
          message: `Script installed (v${result.version})! Publish your site to activate.`,
          type: "success",
        });
      }
    } catch (err) {
      setStatus({
        message: `Error: ${err instanceof Error ? err.message : "Installation failed"}`,
        type: "error",
      });
    } finally {
      setIsInstalling(false);
    }
  }

  async function uninstall() {
    if (!siteId) {
      setStatus({
        message: "Could not detect site. Open this app from the Webflow Designer.",
        type: "error",
      });
      return;
    }

    setIsRemoving(true);
    setStatus({ message: "Removing script...", type: "info" });

    try {
      await removeScript(siteId, sessionToken);

      setIsInstalled(false);
      setScriptVersion(null);
      setStatus({
        message: "Script removed! Publish your site to apply changes.",
        type: "success",
      });
    } catch (err) {
      setStatus({
        message: `Error: ${err instanceof Error ? err.message : "Removal failed"}`,
        type: "error",
      });
    } finally {
      setIsRemoving(false);
    }
  }

  return {
    install,
    uninstall,
    isInstalling,
    isRemoving,
    isChecking,
    isInstalled,
    scriptVersion,
    status,
  };
}
