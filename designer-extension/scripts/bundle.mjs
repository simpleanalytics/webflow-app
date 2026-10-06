import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { zipSync } from "fflate";

// Webflow's bundle format is the public directory contents plus webflow.json.
// Package only built assets; never include source, environment files or secrets.
const files = { "webflow.json": new Uint8Array(readFileSync("webflow.json")) };
const config = JSON.parse(readFileSync("webflow.json", "utf8"));
const allowed = new Set([".html", ".js", ".css", ".json", ".svg", ".png", ".jpg", ".ico", ".woff", ".woff2"]);
function collect(directory, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path, `${name}/`);
    else if (entry.isFile() && allowed.has(extname(name))) files[name] = new Uint8Array(readFileSync(path));
    else throw new Error(`Unexpected bundle entry: ${name}`);
  }
}
collect(config.publicDir);
if (!files["index.html"]) throw new Error("Missing extension index.html");
const bundle = zipSync(files, { level: 9 });
if (bundle.length >= 5 * 1024 * 1024) throw new Error("Webflow bundles must be smaller than 5 MB");
writeFileSync("bundle.zip", bundle);
console.log(`Created bundle.zip (${bundle.length} bytes)`);
