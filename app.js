process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Load .env / .env.local / .env.production from this folder so the app gets its
// configuration on Plesk (does NOT override variables already set by Plesk's
// env-vars panel). @next/env ships with Next.
require("@next/env").loadEnvConfig(__dirname, false);

const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const hostname = "0.0.0.0";

const app = next({
  dev: false,
  dir: __dirname,
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, hostname, () => {
    console.log(`Ice Pulse running on http://${hostname}:${port}`);
  });
});