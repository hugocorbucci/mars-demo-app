#!/usr/bin/env node
/**
 * Local static UI + /api reverse-proxy to mars-demo-api.
 * Mirrors App Platform ingress (web → /, api → /api).
 *
 * Env:
 *   UI_PORT   (default 3000) — listen for browser
 *   API_URL   (default http://127.0.0.1:8080) — upstream API
 *   UI_ROOT   (default components/mars-demo-ui/public)
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const UI_PORT = Number(process.env.UI_PORT || 3000);
const API_URL = process.env.API_URL || "http://127.0.0.1:8080";
const UI_ROOT = process.env.UI_ROOT || join(root, "components/mars-demo-ui/public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function proxyApi(req, res) {
  const upstream = new URL(req.url || "/", API_URL);
  const headers = { ...req.headers, host: upstream.host };
  const opts = {
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port,
    path: upstream.pathname + upstream.search,
    method: req.method,
    headers,
  };
  const preq = http.request(opts, (pres) => {
    res.writeHead(pres.statusCode || 502, pres.headers);
    pres.pipe(res);
  });
  preq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `api proxy: ${err.message}` }));
  });
  req.pipe(preq);
}

function serveStatic(req, res) {
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path === "/") path = "/index.html";
  const file = join(UI_ROOT, path);
  if (!file.startsWith(UI_ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    const fallback = join(UI_ROOT, "404.html");
    if (existsSync(fallback)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      createReadStream(fallback).pipe(res);
      return;
    }
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api")) return proxyApi(req, res);
  return serveStatic(req, res);
});

server.listen(UI_PORT, () => {
  console.log(`mars-demo local UI+proxy  http://127.0.0.1:${UI_PORT}`);
  console.log(`  /api → ${API_URL}`);
  console.log(`  static ← ${UI_ROOT}`);
});
