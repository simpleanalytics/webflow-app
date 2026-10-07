// Auth & User Types
export interface TokenResponse {
  sessionToken: string;
}

export interface DecodedToken {
  user: User;
  exp: number;
  iat?: number;
  iss?: string;
}

export interface User {
  firstName: string;
  email: string;
}

export interface StoredUser extends User {
  sessionToken: string;
  exp: number;
}

// Simple Analytics Script Config
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

// Result from the register endpoint
export interface RegisteredScript {
  id: string;
  version: string;
  updated: boolean;
}

// Result from the status endpoint
export interface ScriptStatus {
  installed: boolean;
  version?: string;
}

// Status message display
export interface StatusInfo {
  message: string;
  type: "success" | "error" | "info" | "";
}

// Environment Variables Type
export interface ImportMetaEnv {
  VITE_DATA_CLIENT_URL: string;
}
