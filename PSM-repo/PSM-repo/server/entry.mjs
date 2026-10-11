// Self-hosted server: serves the website, the /api routes and runs autopilot every 10 minutes.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import api from "../netlify/functions/api.mjs";
import autopost from "../netlify/functions/autopost.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = process.env.PUBLIC_DIR || path.join(HERE, "..", "public");
const PORT = +process.env.PORT || 8080;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

async function readBody(req, limit = 40 * 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("too large"); chunks.push(c); }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const proto = req.headers["x-forwarded-proto"] || "http";
      const r = await api(new Request(`${proto}://${req.headers.host}${req.url}`, { method: req.method, headers, body }));
      const out = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(out); return;
    }
    if (url.pathname === "/healthz") { res.writeHead(200); res.end("ok"); return; }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    let data;
    try { data = await fs.readFile(file); } catch { data = await fs.readFile(path.join(PUBLIC, "index.html")); }
    const ext = path.extname(file);
    res.writeHead(200, { "content-type": MIME[ext] || "text/html; charset=utf-8", "cache-control": ext === ".html" || !ext ? "no-cache" : "public, max-age=3600" });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Daily Quote Cards on http://127.0.0.1:${PORT}`));

async function tick() { try { await autopost(); } catch (e) { console.error("autopost:", e.message); } }
setInterval(tick, 10 * 60 * 1000); setTimeout(tick, 30 * 1000);
