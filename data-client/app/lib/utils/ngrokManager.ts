import ngrok from "@ngrok/ngrok";
import chalk from "chalk";

/**
 * Ngrok Utility Functions
 * ------------------------
 * This file provides utility functions for managing ngrok tunnels.
 */

/**
 * Draws a box around the content with a border.
 *
 * @param {string} content - The content to be displayed inside the box.
 * @returns {string} The content wrapped in a box border.
 */
function drawBox(content: string): string {
  const lines = content.split("\n");
  const width = Math.max(...lines.map((line) => stripAnsi(line).length));

  const top = `╭${"─".repeat(width + 2)}╮`;
  const bottom = `╰${"─".repeat(width + 2)}╯`;

  const paddedLines = lines.map((line) => {
    const visibleLength = stripAnsi(line).length;
    const padding = " ".repeat(width - visibleLength);
    return `│ ${line}${padding} │`;
  });

  return [
    "",
    chalk.blue(top),
    ...paddedLines.map((line) => chalk.blue(line)),
    chalk.blue(bottom),
    "",
  ].join("\n");
}

/**
 * Strips ANSI color codes from a string to calculate its length.
 *
 * @param {string} string - The string to strip ANSI color codes from.
 * @returns {string} The string with ANSI color codes removed.
 */
function stripAnsi(string: string): string {
  return string.replace(/\u001b\[[0-9]{1,2}m/g, "");
}

export async function startNgrok(port: number): Promise<string> {
  console.log(chalk.yellow("⚡ Starting ngrok tunnel..."));

  try {
    const listener = await ngrok.connect({
      addr: port,
      authtoken: process.env.NGROK_AUTH_TOKEN,
    });

    const url = listener.url();
    if (!url) throw new Error("Failed to get ngrok URL");

    console.log(chalk.green("✓ Ngrok tunnel started successfully"));
    return url;
  } catch (error) {
    console.error(chalk.red("✗ Ngrok failed to start:"), error);
    throw error;
  }
}

/**
 * Sets up the development environment by starting an ngrok tunnel and displaying URLs.
 *
 * @returns {Promise<string>} The URL of the ngrok tunnel.
 */
export async function setupDevEnvironment(): Promise<string> {
  try {
    const PORT = parseInt(process.env.PORT || "3000");
    const localUrl = `http://localhost:${PORT}`;
    const ngrokUrl = process.env.NGROK_AUTH_TOKEN
      ? await startNgrok(PORT)
      : null;

    const baseUrl = ngrokUrl
      ? `${ngrokUrl}/api/auth/callback`
      : `${localUrl}/api/auth/callback`;
    const message = [
      chalk.bold("Development Environment"),
      "",
      `${chalk.bold("Local URL:  ")}${chalk.cyan(localUrl)}`,
      `${chalk.bold("Callback:   ")}${chalk.cyan(`${baseUrl}`)}`,
      "",
      `${chalk.yellow("⚠")} ${chalk.bold(
        "Update your Webflow callback URL to:"
      )}`,
      chalk.cyan(`${baseUrl}`),
    ].join("\n");

    console.log(drawBox(message));
    return baseUrl;
  } catch (error) {
    console.error(
      chalk.red("Error setting up development environment:"),
      error
    );
    throw error;
  }
}
