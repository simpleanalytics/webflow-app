import { setupDevEnvironment } from "../app/lib/utils/ngrokManager";

async function setupTunnel() {
  try {
    await setupDevEnvironment();
  } catch (error) {
    console.error("Tunnel setup failed:", error);
    process.exit(1);
  }
}

setupTunnel();
