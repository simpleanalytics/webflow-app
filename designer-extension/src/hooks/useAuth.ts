import { useCallback, useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";

const baseUrl = import.meta.env.VITE_DATA_CLIENT_URL;
interface Session { siteId: string; exp: number; }

export function useAuth() {
  const [sessionToken, setSessionToken] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const exchanging = useRef(false);

  const exchangeAndVerifyIdToken = useCallback(async () => {
    if (exchanging.current) return;
    exchanging.current = true;
    try {
      const { siteId } = await webflow.getSiteInfo();
      const idToken = await webflow.getIdToken();
      const response = await fetch(`${baseUrl}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, idToken }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Authorization failed");
      const data = await response.json();
      const session = jwtDecode<Session>(data.sessionToken);
      if (session.siteId !== siteId || session.exp * 1000 <= Date.now()) {
        throw new Error("Invalid session");
      }
      setSessionToken(data.sessionToken);
    } catch {
      setSessionToken("");
    } finally {
      exchanging.current = false;
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    // Discard personal data and sessions left by the previous app version.
    localStorage.removeItem("wf_hybrid_user");
    localStorage.removeItem("explicitly_logged_out");
    void exchangeAndVerifyIdToken();
  }, [exchangeAndVerifyIdToken]);

  useEffect(() => {
    if (!sessionToken) return;
    const delay = Math.max(0, jwtDecode<Session>(sessionToken).exp * 1000 - Date.now() - 60000);
    const timer = setTimeout(exchangeAndVerifyIdToken, delay);
    return () => clearTimeout(timer);
  }, [sessionToken, exchangeAndVerifyIdToken]);

  return { sessionToken, isAuthLoading, exchangeAndVerifyIdToken, logout: () => setSessionToken("") };
}
