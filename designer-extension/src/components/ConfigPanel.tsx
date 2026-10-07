import { useState, useCallback, useEffect } from "react";
import { useSites } from "../hooks/useSites";
import { useInstallScript } from "../hooks/useInstallScript";
import { StatusMessage } from "./StatusMessage";
import { ScriptConfig, StatusInfo } from "../types/types";
import { disconnectWebflow } from "../services/api";

const DEFAULT_CONFIG: ScriptConfig = {
  trackPageviews: true,
  trackEvents: false,
  collectDNT: false,
  automatedEvents: true,
  hashMode: false,
  ignorePages: "",
  customDomain: "",
  overwriteDomain: "",
  collectOutbound: true,
  collectEmails: true,
  collectDownloads: true,
  downloadExtensions: "pdf,csv,docx,xlsx,zip,doc,xls",
  usePageTitle: true,
  collectFullUrls: false,
  collectLinkEvents: false,
};

function getStorageKey(siteId: string | null): string | null {
  return siteId ? `sa_config_${siteId}` : null;
}

function loadConfig(siteId: string | null): ScriptConfig {
  const key = getStorageKey(siteId);
  if (!key) return { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem(key);
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {
    // corrupt data — fall back to defaults
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(siteId: string | null, config: ScriptConfig) {
  const key = getStorageKey(siteId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // storage full or unavailable
  }
}

interface ConfigPanelProps {
  sessionToken: string;
  onDisconnect: () => void;
}

export function ConfigPanel({ sessionToken, onDisconnect }: ConfigPanelProps) {
  const { siteId } = useSites();
  const {
    install,
    uninstall,
    isInstalling,
    isRemoving,
    isChecking,
    isInstalled,
    status,
  } = useInstallScript(siteId, sessionToken);
  const [activeTab, setActiveTab] = useState<"settings" | "info">("settings");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectStatus, setDisconnectStatus] = useState<StatusInfo>({
    message: "",
    type: "",
  });

  const [config, setConfig] = useState<ScriptConfig>(() => loadConfig(siteId));
  const [loadedSiteId, setLoadedSiteId] = useState<string | null>(null);

  // Reload config when siteId becomes available
  useEffect(() => {
    if (siteId) {
      setConfig(loadConfig(siteId));
      setLoadedSiteId(siteId);
    }
  }, [siteId]);

  // Do not persist defaults until the saved config for this site has loaded.
  useEffect(() => {
    if (siteId && loadedSiteId === siteId) saveConfig(siteId, config);
  }, [siteId, loadedSiteId, config]);

  function handleToggle(key: keyof ScriptConfig) {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleTextChange(key: keyof ScriptConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = "data-sa-link-event";
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  }, []);

  function handleInstall() {
    setDisconnectStatus({ message: "", type: "" });
    install(config);
  }

  async function handleDisconnect() {
    if (!siteId) {
      setDisconnectStatus({
        message: "Could not detect site. Open this app from the Webflow Designer.",
        type: "error",
      });
      return;
    }
    if (!window.confirm(
      "Disconnect Simple Analytics from this site? This removes the app's script and stored Webflow authorization. Publish the site afterward to apply the script removal."
    )) return;

    setIsDisconnecting(true);
    setDisconnectStatus({ message: "Disconnecting Webflow...", type: "info" });
    try {
      await disconnectWebflow(siteId, sessionToken);
      const key = getStorageKey(siteId);
      try {
        if (key) localStorage.removeItem(key);
      } catch {
        // Authorization is already removed; local storage may be unavailable.
      }
      onDisconnect();
    } catch (error) {
      setDisconnectStatus({
        message: `Error: ${error instanceof Error ? error.message : "Disconnection failed"}`,
        type: "error",
      });
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="panel">
      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
        <button
          className={`tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          How it works
        </button>
      </div>

      {/* Settings tab */}
      {activeTab === "settings" && (
        <>
          {/* Main options */}
          <div className="option-group">
            <div className="option">
              <input
                type="checkbox"
                checked={config.collectLinkEvents}
                onChange={() => handleToggle("collectLinkEvents")}
              />
              <div className="option-content">
                <div className="option-label">Collect link click events</div>
                <div className="option-description">
                  Track clicks on links with a custom attribute. (default: off)
                </div>
                {config.collectLinkEvents && (
                  <div className="option-hint">
                    Add{" "}
                    <code className="copyable" onClick={handleCopy} title="Click to copy">
                      data-sa-link-event
                      <svg className="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {copied ? (
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        ) : (
                          <>
                            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
                          </>
                        )}
                      </svg>
                    </code>{" "}
                    as a custom attribute on
                    any link in Webflow (Element Settings &rarr; Custom Attributes).
                    Set the value to your event name, e.g. <code>cta_click</code>.
                  </div>
                )}
              </div>
            </div>

            <div className="option">
              <input
                type="checkbox"
                checked={config.automatedEvents}
                onChange={() => handleToggle("automatedEvents")}
              />
              <div className="option-content">
                <div className="option-label">Collect automated events</div>
                <div className="option-description">
                  Enable or disable automated events collection. (default: on)
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            <span>Advanced Settings</span>
            <span className={`chevron ${showAdvanced ? "chevron-open" : ""}`}>&#9660;</span>
          </button>

          {showAdvanced && (
            <div className="option-group advanced-section">
              <div className="option option-vertical">
                <div className="option-content">
                  <div className="option-label">Custom domain</div>
                  <div className="option-description">
                    Use a custom domain to bypass ad-blockers. (default: empty)
                  </div>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="sa.yourdomain.com"
                    value={config.customDomain}
                    onChange={(e) => handleTextChange("customDomain", e.target.value)}
                  />
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.collectDNT}
                  onChange={() => handleToggle("collectDNT")}
                />
                <div className="option-content">
                  <div className="option-label">Collect Do Not Track visits</div>
                  <div className="option-description">
                    Enable analytics for users with Do Not Track enabled. (default: off)
                  </div>
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.trackPageviews}
                  onChange={() => handleToggle("trackPageviews")}
                />
                <div className="option-content">
                  <div className="option-label">Track pageviews</div>
                  <div className="option-description">
                    Automatically track page visits and navigation. (default: on)
                  </div>
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.trackEvents}
                  onChange={() => handleToggle("trackEvents")}
                />
                <div className="option-content">
                  <div className="option-label">Track events</div>
                  <div className="option-description">
                    Add sa_event() helper for custom event tracking. (default: off)
                  </div>
                </div>
              </div>

              <div className="option option-vertical">
                <div className="option-content">
                  <div className="option-label">Ignored pages</div>
                  <div className="option-description">
                    Disable Simple Analytics on certain pages. (default: empty)
                  </div>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="/page1, /page2, /admin/*"
                    value={config.ignorePages}
                    onChange={(e) => handleTextChange("ignorePages", e.target.value)}
                  />
                </div>
              </div>

              <div className="option option-vertical">
                <div className="option-content">
                  <div className="option-label">Overwrite domain</div>
                  <div className="option-description">
                    Overwrite your domain name here. (default: empty)
                  </div>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="example.com"
                    value={config.overwriteDomain}
                    onChange={(e) => handleTextChange("overwriteDomain", e.target.value)}
                  />
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.hashMode}
                  onChange={() => handleToggle("hashMode")}
                />
                <div className="option-content">
                  <div className="option-label">Enable hash mode</div>
                  <div className="option-description">
                    Enable hash mode to track URLs with hashes as separate page views. (default: off)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Events section */}
          <button
            className="advanced-toggle"
            onClick={() => setShowEvents((prev) => !prev)}
          >
            <span>Events</span>
            <span className={`chevron ${showEvents ? "chevron-open" : ""}`}>&#9660;</span>
          </button>

          {showEvents && (
            <div className="option-group advanced-section">
              <div className="option">
                <input
                  type="checkbox"
                  checked={config.collectOutbound}
                  onChange={() => handleToggle("collectOutbound")}
                />
                <div className="option-content">
                  <div className="option-label">Collect outbound links</div>
                  <div className="option-description">
                    It will track clicks on links to other websites. (default: on)
                  </div>
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.collectEmails}
                  onChange={() => handleToggle("collectEmails")}
                />
                <div className="option-content">
                  <div className="option-label">Collect email clicks</div>
                  <div className="option-description">
                    It will track clicks on email addresses. (default: on)
                  </div>
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.collectDownloads}
                  onChange={() => handleToggle("collectDownloads")}
                />
                <div className="option-content">
                  <div className="option-label">Collect downloads</div>
                  <div className="option-description">
                    It will track downloads of certain files. (default: on)
                  </div>
                </div>
              </div>

              <div className="option option-vertical">
                <div className="option-content">
                  <div className="option-label">Collect downloads extensions</div>
                  <div className="option-description">
                    Extensions to enable download tracking for.
                  </div>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="pdf,csv,docx,xlsx,zip,doc,xls"
                    value={config.downloadExtensions}
                    onChange={(e) => handleTextChange("downloadExtensions", e.target.value)}
                  />
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.usePageTitle}
                  onChange={() => handleToggle("usePageTitle")}
                />
                <div className="option-content">
                  <div className="option-label">Use page title</div>
                  <div className="option-description">
                    Enable or disable title collection. (default: on)
                  </div>
                </div>
              </div>

              <div className="option">
                <input
                  type="checkbox"
                  checked={config.collectFullUrls}
                  onChange={() => handleToggle("collectFullUrls")}
                />
                <div className="option-content">
                  <div className="option-label">Collect full URLs</div>
                  <div className="option-description">
                    Enable or disable full URL collection. (default: off)
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="button-group">
            {isChecking ? (
              <button className="btn btn-primary" disabled>
                Checking...
              </button>
            ) : isInstalled ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleInstall}
                  disabled={isInstalling || isRemoving || isDisconnecting}
                >
                  {isInstalling ? "Updating..." : "Update Script"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={uninstall}
                  disabled={isInstalling || isRemoving || isDisconnecting}
                >
                  {isRemoving ? "Removing..." : "Remove Script"}
                </button>
              </>
            ) : (
              <>
                <div className="option-hint">
                  Already added Simple Analytics in Webflow Site settings? Remove
                  that manual script before installing to avoid duplicate pageviews.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleInstall}
                  disabled={isInstalling || isDisconnecting}
                >
                  {isInstalling ? "Installing..." : "Install Script"}
                </button>
              </>
            )}
          </div>

        </>
      )}

      {/* How it works tab */}
      {activeTab === "info" && (
        <div className="info-tab">
          <div className="info-section">
            <div className="info-label">What is Simple Analytics?</div>
            <p className="info-text">
              Privacy-friendly analytics for your Webflow site. No cookies, fully
              GDPR compliant. Get the insights you need without compromising your
              visitors' privacy.
            </p>
          </div>

          <div className="info-section">
            <div className="info-label">How to use this app</div>
            <p className="info-text">
              Configure your tracking preferences in the Settings tab, then click
              Install Script. The app will automatically add the Simple Analytics
              script to your site. After installing, publish your site to start
              collecting data.
            </p>
            <p className="info-text">
              If Simple Analytics was previously added in Webflow Site settings,
              remove that manual script first. Webflow does not let apps inspect
              custom code added manually or by other apps.
            </p>
          </div>

          <div className="info-links">
            <a
              href="https://dashboard.simpleanalytics.com/websites"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Open Dashboard
            </a>
            <a
              href="https://docs.simpleanalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Documentation
            </a>
          </div>
        </div>
      )}

      <StatusMessage status={disconnectStatus.message ? disconnectStatus : status} />

      <div className="panel-footer">
        <span className="footer-top">
          Powered by{" "}
          <a href="https://uncode.nl" target="_blank" rel="noopener noreferrer">
            Uncode
          </a>{" "}
          &{" "}
          <a href="https://klader.nl" target="_blank" rel="noopener noreferrer">
            Klader
          </a>
        </span>
        <span className="footer-bottom">
          <button
            className="footer-disconnect"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect Webflow"}
          </button>
          <span>&middot;</span>
          <a href="https://tally.so/r/lbd86B" target="_blank" rel="noopener noreferrer">
            Feedback
          </a>
          <span>&middot;</span>
          <span>v1.0.0</span>
        </span>
      </div>
    </div>
  );
}
