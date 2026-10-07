# Simple Analytics Webflow App

A Webflow Hybrid App that lets site owners add and configure
[Simple Analytics](https://www.simpleanalytics.com/) from the Webflow Designer.
The Designer Extension provides the interface; the Next.js data client handles
OAuth and manages the app's custom code through the Webflow Data API.

## Architecture

```text
designer-extension/          Vite + React extension shown in Webflow Designer
  src/App.tsx                Authentication gate and configuration panel
  src/hooks/useAuth.ts       Designer ID-token exchange
  src/services/api.ts        Calls to the data-client API

data-client/                 Next.js API and OAuth service
  app/api/auth/              OAuth, session, and disconnect routes
  app/api/scripts/           Register, apply, inspect, and remove app scripts
  app/lib/utils/database.ts  Encrypted OAuth-token storage in Redis
```

## Prerequisites

- Node.js 24 or newer
- Redis 7
- A Webflow site and workspace
- A registered Webflow App

## Local setup

1. Clone this repository and install the locked dependencies:

   ```bash
   git clone https://github.com/simpleanalytics/webflow-app.git
   cd webflow-app
   npm ci
   npm run install:all
   ```

2. Start a local Redis instance. This example exposes Redis only on localhost:

   ```bash
   docker run --rm --name webflow-app-redis -p 127.0.0.1:6379:6379 redis:7.4.8
   ```

3. Register a Webflow App and configure this redirect URI:

   ```text
   http://localhost:3001/api/auth/callback
   ```

   Enable these scopes:

   - `authorized_user:read`
   - `sites:read`
   - `custom_code:read`
   - `custom_code:write`

4. Create the backend environment file:

   ```bash
   cp data-client/.env.example data-client/.env
   ```

   Set the Webflow client ID and secret. The checked-in defaults point the
   backend at local Redis and the local Designer Extension.

5. Start both applications:

   ```bash
   npm run dev
   ```

   - Data client: `http://localhost:3001`
   - Designer Extension: `http://localhost:1337`

6. Open `http://localhost:3001` to authorize the app, then launch the
   development app from the Webflow Designer Apps panel.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `WEBFLOW_CLIENT_ID` | Yes | OAuth client ID from Webflow |
| `WEBFLOW_CLIENT_SECRET` | Yes | OAuth client secret; also derives the at-rest encryption key |
| `REDIS_URL` | Yes | Redis connection URL |
| `APP_BASE_URL` | Yes | Public origin of the data client; its OAuth callback must match Webflow exactly |
| `DESIGNER_EXTENSION_URI` | Yes | Exact Designer Extension origin allowed by CORS and `postMessage` |
| `PORT` | No | Local data-client port; defaults to `3001` |
| `NGROK_AUTH_TOKEN` | No | Development tunnel credential |

Keep `.env` files out of version control; they contain credentials.

## Script ownership and uninstalling

Webflow only exposes custom code owned by this app. It cannot detect a Simple
Analytics script added manually in Site settings or by another app. Remove any
existing manual installation before using this app to avoid duplicate pageviews.

Before uninstalling the Webflow App, choose **Disconnect Webflow** in the
extension and confirm the action. This removes the app-owned site script,
deletes the stored site authorization, and revokes the Webflow grant when its
last connected site is removed. Publish the Webflow site afterward so script
removal takes effect.

## Validation

```bash
npm test --prefix data-client
npm run lint --prefix data-client
npm run lint --prefix designer-extension
npm run build
```

## Security

- OAuth tokens are encrypted with AES-256-GCM before Redis persistence.
- Designer sessions are short-lived, site-bound JWTs.
- OAuth callbacks use a one-time state value and the same configured redirect
  URI for authorization and token exchange.
- API CORS is restricted to `DESIGNER_EXTENSION_URI`.
- Disconnect removes app-owned custom code and stored authorization data.

## Tech stack

- Next.js, Redis, and the Webflow Data API
- React, Vite, and the Webflow Designer API

## License

MIT
