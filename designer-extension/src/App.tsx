import { useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { AuthScreen } from "./components/AuthScreen";
import { ConfigPanel } from "./components/ConfigPanel";
import "./App.css";

function App() {
  const { sessionToken, isAuthLoading, exchangeAndVerifyIdToken, logout } = useAuth();
  const hasCheckedToken = useRef(false);

  useEffect(() => {
    webflow.setExtensionSize("comfortable");

    if (!hasCheckedToken.current) {
      const storedUser = localStorage.getItem("wf_hybrid_user");
      const wasLoggedOut = localStorage.getItem("explicitly_logged_out");

      if (storedUser && !wasLoggedOut) {
        exchangeAndVerifyIdToken();
      }
      hasCheckedToken.current = true;
    }

    const handleAuthComplete = async (event: MessageEvent) => {
      if (event.data === "authComplete") {
        localStorage.removeItem("explicitly_logged_out");
        await exchangeAndVerifyIdToken();
      }
    };

    window.addEventListener("message", handleAuthComplete);
    return () => {
      window.removeEventListener("message", handleAuthComplete);
      hasCheckedToken.current = false;
    };
  }, [exchangeAndVerifyIdToken]);

  if (isAuthLoading) {
    return <div className="panel"><p className="section-text">Loading...</p></div>;
  }

  if (sessionToken) {
    return <ConfigPanel sessionToken={sessionToken} onLogout={logout} />;
  }

  return <AuthScreen onAuth={exchangeAndVerifyIdToken} />;
}

export default App;
