export interface ScriptConfig {
  trackPageviews: boolean;
  trackEvents: boolean;
  collectDNT: boolean;
  automatedEvents: boolean;
  hashMode: boolean;
  ignorePages: string;
  customDomain: string;
  overwriteDomain: string;
  collectOutbound: boolean;
  collectEmails: boolean;
  collectDownloads: boolean;
  downloadExtensions: string;
  usePageTitle: boolean;
  collectFullUrls: boolean;
  collectLinkEvents: boolean;
}

/**
 * Get the base CDN URL, using a custom domain if provided.
 */
function getBaseUrl(config: ScriptConfig): string {
  if (config.customDomain) {
    return `https://${config.customDomain}`;
  }
  return "https://scripts.simpleanalyticscdn.com";
}

/**
 * Generate an inline Simple Analytics script based on configuration options.
 *
 * Ported from the original Simple Analytics Webflow app (public/index.js).
 */
export function generateScript(config: ScriptConfig): string {
  const baseUrl = getBaseUrl(config);
  let code = "(function(){";

  if (config.trackEvents || config.collectLinkEvents) {
    code +=
      'window.sa_event=window.sa_event||function(){var a=[].slice.call(arguments);window.sa_event.q?window.sa_event.q.push(a):window.sa_event.q=[a]};';
  }

  code += 'var s=document.createElement("script");';
  code += `s.src="${baseUrl}/latest.js";`;
  code += "s.async=true;";

  if (!config.trackPageviews) {
    code += 's.dataset.autoCollect="false";';
  }
  if (config.collectDNT) {
    code += 's.dataset.collectDnt="true";';
  }
  if (config.hashMode) {
    code += 's.dataset.mode="hash";';
  }
  if (config.ignorePages) {
    code += `s.dataset.ignorePages="${config.ignorePages}";`;
  }
  if (config.overwriteDomain) {
    code += `s.dataset.hostname="${config.overwriteDomain}";`;
  }

  code += "document.head.appendChild(s);";

  if (config.automatedEvents) {
    code += 'var ae=document.createElement("script");';
    code += `ae.src="${baseUrl}/auto-events.js";`;
    code += "ae.async=true;";

    // Build data-collect value from individual toggles
    const collectTypes: string[] = [];
    if (config.collectOutbound) collectTypes.push("outbound");
    if (config.collectEmails) collectTypes.push("emails");
    if (config.collectDownloads) collectTypes.push("downloads");
    if (collectTypes.length > 0 && collectTypes.length < 3) {
      code += `ae.dataset.collect="${collectTypes.join(",")}";`;
    }

    if (config.downloadExtensions) {
      code += `ae.dataset.extensions="${config.downloadExtensions}";`;
    }
    if (!config.usePageTitle) {
      code += 'ae.dataset.useTitle="false";';
    }
    if (config.collectFullUrls) {
      code += 'ae.dataset.fullUrls="true";';
    }

    code += "document.head.appendChild(ae);";
  }

  if (config.collectLinkEvents) {
    code +=
      'function saLoadedLinkEvents(){document.querySelectorAll("a[data-sa-link-event]").forEach(function(e){var h=e.getAttribute("href"),n=e.getAttribute("data-sa-link-event");if(h&&window.sa_event&&window.sa_loaded){e.addEventListener("click",function(ev){if(e.getAttribute("target")==="_blank"){ev.preventDefault();window.sa_event(n,function(){window.open(h,"_blank")})}else{ev.preventDefault();window.sa_event(n,function(){window.location.href=h})}})}})}if(document.readyState==="ready"||document.readyState==="complete"){saLoadedLinkEvents()}else{document.addEventListener("readystatechange",function(ev){if(ev.target.readyState==="complete")saLoadedLinkEvents()})}';
  }

  code += "})();";

  return code;
}
