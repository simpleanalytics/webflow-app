import { createServer, IncomingMessage, ServerResponse } from "http";
import next from "next";
import { setupDevEnvironment } from "../app/lib/utils/ngrokManager";

function validateEnv() {
  const required = ["WEBFLOW_CLIENT_ID", "WEBFLOW_CLIENT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy .env.example to .env and fill in your Webflow app credentials."
    );
    process.exit(1);
  }
}

async function dev() {
  const app = next({ dev: true });
  const handle = app.getRequestHandler();

  await app.prepare();

  validateEnv();

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      try {
        await handle(req, res);
      } catch (err) {
        console.error("Error handling request:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  );

  const port = parseInt(process.env.PORT || "3001");
  server.listen(port, async () => {
    console.log(`> Ready on http://localhost:${port}`);
    await setupDevEnvironment();
  });
}

dev().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
