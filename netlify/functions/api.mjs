import { store, json, authorized, listPages, runItem } from "../lib/shared.mjs";

const SAFE = /^[A-Za-z0-9_.|:-]{1,120}$/;

function b64ToBytes(b64) {
  const clean = String(b64).replace(/^data:[^,]+,/, "");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const s = store();
  const siteUrl = process.env.URL || url.origin;

  try {
    // Public: card images for Meta to fetch. Keys contain a random token, so they can't be guessed.
    if (req.method === "GET" && parts[0] === "img" && parts[1]) {
      const key = parts[1].replace(/\.jpg$/, "");
      if (!SAFE.test(key)) return new Response("Not found", { status: 404 });
      const buf = await s.get(`img/${key}`, { type: "arrayBuffer" });
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
    }

    const auth = authorized(req);
    if (!auth.ok) return json({ error: auth.reason }, 401);

    // Health / status
    if (parts[0] === "health") {
      const meta = await s.get("meta", { type: "json" });
      const { blobs } = await s.list({ prefix: "queue/" });
      return json({
        ok: true,
        connected: meta ? { page: meta.pageName, ig: meta.igUsername || null } : null,
        queued: blobs.length,
      });
    }

    // Full app state sync (settings, library, plan)
    if (parts[0] === "state") {
      if (req.method === "GET") return json((await s.get("state", { type: "json" })) || { updatedAt: 0, state: null });
      if (req.method === "PUT") {
        const body = await req.json();
        if (!body || !body.state) return json({ error: "missing state" }, 400);
        await s.setJSON("state", { updatedAt: body.updatedAt || Date.now(), state: body.state });
        return json({ ok: true });
      }
    }

    // Photos (stored as data URLs)
    if (parts[0] === "photo" && parts[1]) {
      if (!SAFE.test(parts[1])) return json({ error: "bad id" }, 400);
      if (req.method === "GET") { const d = await s.get(`photo/${parts[1]}`); return d ? new Response(d, { headers: { "content-type": "text/plain" } }) : json({ error: "not found" }, 404); }
      if (req.method === "PUT") { await s.set(`photo/${parts[1]}`, await req.text()); return json({ ok: true }); }
    }
    if (parts[0] === "photos" && req.method === "GET") {
      const { blobs } = await s.list({ prefix: "photo/" });
      return json({ ids: blobs.map((b) => b.key.slice(6)) });
    }

    // Autopilot queue
    if (parts[0] === "queue") {
      if (req.method === "GET" && !parts[1]) {
        const { blobs } = await s.list({ prefix: "queue/" });
        const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
        items.forEach((i) => { if (i) delete i.captionFb; });
        return json({ items: items.filter(Boolean).sort((a, b) => a.when.localeCompare(b.when)) });
      }
      if (req.method === "POST" && !parts[1]) {
        const it = await req.json();
        if (!it || !SAFE.test(it.key || "") || !it.when || !it.image) return json({ error: "bad item" }, 400);
        const old = await s.get(`queue/${it.key}`, { type: "json" });
        if (old && old.status === "posted") return json({ ok: true, skipped: "already posted" });
        const imgKey = `${it.key.replace(/[|:]/g, "-")}-${crypto.randomUUID().slice(0, 12)}`;
        if (old && old.imgKey) await s.delete(`img/${old.imgKey}`);
        await s.set(`img/${imgKey}`, b64ToBytes(it.image));
        const item = {
          key: it.key, when: new Date(it.when).toISOString(), targets: (it.targets || ["fb", "ig"]).filter((t) => t === "fb" || t === "ig"),
          captionFb: it.captionFb || "", captionIg: it.captionIg || "", label: it.label || "", imgKey, status: "scheduled", attempts: 0, results: {},
        };
        await s.setJSON(`queue/${it.key}`, item);
        return json({ ok: true });
      }
      if (parts[1] && SAFE.test(parts[1])) {
        const item = await s.get(`queue/${parts[1]}`, { type: "json" });
        if (!item) return json({ error: "not found" }, 404);
        if (req.method === "DELETE") { await s.delete(`queue/${parts[1]}`); if (item.imgKey) await s.delete(`img/${item.imgKey}`); return json({ ok: true }); }
        if (req.method === "POST" && parts[2] === "now") { item.attempts = 0; const done = await runItem(s, item, siteUrl); return json({ ok: done.status === "posted", item: done }); }
      }
    }

    if (parts[0] === "log") return json({ log: (await s.get("log", { type: "json" })) || [] });

    // Connect Facebook Page + Instagram
    if (parts[0] === "connect" && req.method === "POST") {
      const body = await req.json();
      if (body.pageId) {
        const pending = (await s.get("pendingPages", { type: "json" })) || [];
        const p = pending.find((x) => x.id === body.pageId);
        if (!p) return json({ error: "page not found" }, 400);
        await s.setJSON("meta", { pageId: p.id, pageName: p.name, pageToken: p.token, igId: p.igId, igUsername: p.igUsername, connectedAt: new Date().toISOString() });
        await s.delete("pendingPages");
        return json({ ok: true, page: p.name, ig: p.igUsername });
      }
      const pages = await listPages(body);
      if (!pages.length) return json({ error: "This Facebook login manages no Pages. Make sure you selected your Page when creating the token." }, 400);
      if (pages.length === 1) {
        const p = pages[0];
        await s.setJSON("meta", { pageId: p.id, pageName: p.name, pageToken: p.token, igId: p.igId, igUsername: p.igUsername, connectedAt: new Date().toISOString() });
        return json({ ok: true, page: p.name, ig: p.igUsername });
      }
      await s.setJSON("pendingPages", pages);
      return json({ choose: pages.map((p) => ({ id: p.id, name: p.name, igUsername: p.igUsername })) });
    }
    if (parts[0] === "disconnect" && req.method === "POST") { await s.delete("meta"); return json({ ok: true }); }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
};

export const config = { path: "/api/*" };
