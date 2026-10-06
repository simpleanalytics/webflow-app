# Simple Analytics — Webflow Hybrid App

A Webflow Hybrid App that lets site owners add [Simple Analytics](https://www.simpleanalytics.com/) to their Webflow sites directly from the Webflow Designer. It uses the Webflow Data API to inject the Simple Analytics tracking script via Custom Code, and the Designer API to authenticate users.

## Architecture

```
designer-extension/          Vite + React frontend (runs inside Webflow Designer)
  ├── src/App.tsx             Entry point — auth gate + config panel
  ├── src/hooks/useAuth.ts    OAuth token exchange via ID tokens
  └── src/services/api.ts     Calls to the data-client API

data-client/                 Next.js backend (API + OAuth server)
  ├── app/api/auth/           OAuth authorize / callback / token routes
  ├── app/api/scripts/        Register + apply Simple Analytics script
  └── app/lib/utils/          Database (SQLite), JWT, ngrok helper
```

## Prerequisites

- Node.js 18+
- A [Webflow](https://webflow.com) site and workspace
- A registered Webflow App (see Setup step 2)

## Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/runclubs/Simple-Analytics-App.git
   cd Simple-Analytics-App
   ```

2. **Install all dependencies:**

   ```bash
   npm install
   npm run install:all
   ```

   This installs the root dependencies (concurrently), plus all packages for both `data-client/` and `designer-extension/`.

3. **Register a Webflow App** in [your Workspace settings](https://developers.webflow.com/v2.0.0/data/docs/register-an-app):

   - Redirect URI: `http://localhost:3001/api/auth/callback`
   - Required scopes (all four must be enabled):
     - `authorized_user:read`
     - `sites:read`
     - `custom_code:read`
     - `custom_code:write`

   > **Note:** if you forget to enable `authorized_user:read`, the OAuth flow will fail with an `invalid_scope` error.

4. **Create the environment file:**

   ```bash
   cp data-client/.env.example data-client/.env
   ```

   Open `data-client/.env` and fill in your credentials from the Webflow Dashboard (Workspace Settings → Apps & Integrations → Your App):

   | Variable | Required | Where to find it |
   |---|---|---|
   | `WEBFLOW_CLIENT_ID` | Yes | Your app's OAuth Client ID |
   | `WEBFLOW_CLIENT_SECRET` | Yes | Your app's OAuth Client Secret |
   | `NGROK_AUTH_TOKEN` | No | Only needed for external testing |

   The remaining variables (`PORT`, `DESIGNER_EXTENSION_URI`) have sensible defaults and can be left as-is.

   > **Important:** the `.env` file contains secrets and is git-ignored. The `.env.example` file in the repo serves as a reference for which variables are needed. Never commit actual API keys.

5. **Start the app:**

   ```bash
   npm run dev
   ```

   This starts both servers concurrently:
   - **Data Client (backend):** `http://localhost:3001`
   - **Designer Extension (frontend):** `http://localhost:1337`

6. **Authorize the app** by navigating to `http://localhost:3001` in your browser — this redirects to the Webflow OAuth consent screen. Click **Authorize**.

7. **Open the Designer Extension** in the Webflow Designer: Apps panel → your app → **"Launch Development App"**.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WEBFLOW_CLIENT_ID` | Yes | OAuth client ID from Webflow |
| `WEBFLOW_CLIENT_SECRET` | Yes | OAuth client secret from Webflow |
| `NGROK_AUTH_TOKEN` | No | For exposing localhost during development |
| `PORT` | No | Data client port (default: `3001`) |
| `DESIGNER_EXTENSION_URI` | No | Extension origin for CORS + postMessage (default: `http://localhost:1337`) |

## Security

- **Tokens encrypted at rest** — access tokens are AES-256-GCM encrypted in the SQLite database, keyed from `WEBFLOW_CLIENT_SECRET`.
- **Env validation** — the server refuses to start if required credentials are missing.
- **CORS** — the API only accepts requests from the configured `DESIGNER_EXTENSION_URI`.
- **Security headers** — `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on all API responses.
- **postMessage origin** — the OAuth callback targets the extension origin instead of `*`.

## Tech Stack

- **Data Client:** [Next.js](https://nextjs.org/), [Webflow SDK](https://github.com/webflow/js-webflow-api), SQLite
- **Designer Extension:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [Webflow Designer API](https://developers.webflow.com/designer/reference/introduction)

## License

MIT
