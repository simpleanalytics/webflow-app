import { useState } from "react";

const BASE_URL = import.meta.env.VITE_DATA_CLIENT_URL;

interface AuthScreenProps {
  onAuth: () => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);

  async function openAuthScreen() {
    setError(null);

    try {
      const response = await fetch(
        `${BASE_URL}/api/auth/authorize?state=webflow_designer&json=true`
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const { url } = await response.json();

      const authWindow = window.open(url, "_blank", "width=600,height=600");

      const checkWindow = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindow);
          onAuth();
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to start authorization:", err);
      setError("Could not connect to the server. Please check that the data client is running and try again.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#FF4F64" />
          <path
            d="M6 18V10M12 18V6M18 18V14"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <h1>Simple Analytics</h1>
      </div>

      <div className="section">
        <p className="section-text">
          Connect to Webflow to add Simple Analytics to your site.
        </p>
        {error && <p className="section-text" style={{ color: "#e74c3c" }}>{error}</p>}
        <button className="btn btn-primary" onClick={openAuthScreen}>
          Connect to Webflow
        </button>
      </div>
    </div>
  );
}
