import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { AuthScreen } from "./components/AuthScreen";
import { ConfigPanel } from "./components/ConfigPanel";
import "./App.css";

function App() {
  const { sessionToken, isAuthLoading, exchangeAndVerifyIdToken, clearSession } = useAuth();

  useEffect(() => {
    webflow.setExtensionSize("comfortable");

    const handleAuthComplete = async (event: MessageEvent) => {
      if (event.origin === new URL(import.meta.env.VITE_DATA_CLIENT_URL).origin && event.data === "authComplete") {
        await exchangeAndVerifyIdToken();
      }
    };

    window.addEventListener("message", handleAuthComplete);
    return () => {
      window.removeEventListener("message", handleAuthComplete);
    };
  }, [exchangeAndVerifyIdToken]);

  if (isAuthLoading) {
    return <div className="panel"><p className="section-text">Loading...</p></div>;
  }

  if (sessionToken) {
    return <ConfigPanel sessionToken={sessionToken} onDisconnect={clearSession} />;
  }

  return <AuthScreen onAuth={exchangeAndVerifyIdToken} />;
}

export default App;
