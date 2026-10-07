// cloudflare/kvstore.mjs
var KV = null;
function bindKV(kv) {
  KV = kv;
}
var getStore = () => ({
  async get(key, o = {}) {
    if (o.type === "json") return await KV.get(key, "json");
    if (o.type === "arrayBuffer") return await KV.get(key, "arrayBuffer");
    return await KV.get(key, "text");
  },
  async set(key, value) {
    await KV.put(key, value);
  },
  async setJSON(key, value) {
    await KV.put(key, JSON.stringify(value));
  },
  async delete(key) {
    await KV.delete(key);
  },
  async list({ prefix = "" } = {}) {
    const blobs = [];
    let cursor;
    do {
      const r = await KV.list({ prefix, cursor });
      for (const k of r.keys) blobs.push({ key: k.name });
      cursor = r.list_complete ? null : r.cursor;
    } while (cursor);
    return { blobs };
  }
});

// netlify/lib/shared.mjs
function env(name) {
  try {
    const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name);
    if (v) return v;
  } catch (e) {
  }
  return typeof process !== "undefined" && process.env && process.env[name] || "";
}
var graphBase = () => `https://graph.facebook.com/${env("GRAPH_VERSION") || "v25.0"}`;
var store = () => getStore({ name: "quotecards", consistency: "strong" });
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
function authorized(req) {
  const pw = String(env("APP_PASSWORD") || env("QUOTEAPP") || "").trim();
  if (!pw) return { ok: false, reason: "The app password (QUOTEAPP or APP_PASSWORD) is not set in Netlify environment variables" };
  const given = String(req.headers.get("x-app-password") || "").trim();
  if (given.length !== pw.length) return { ok: false, reason: "wrong password" };
  let diff = 0;
  for (let i = 0; i < pw.length; i++) diff |= pw.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, reason: "wrong password" };
}
async function graph(path, params = {}, method = "GET") {
  const url = new URL(graphBase() + path);
  let body;
  if (method === "GET") Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  else body = new URLSearchParams(params);
  const r = await fetch(url, { method, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = new Error(d.error && d.error.message || `Meta error ${r.status}`);
    e.meta = d.error || null;
    throw e;
  }
  return d;
}
async function listPages({ appId, appSecret, userToken }) {
  const ll = await graph("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken
  });
  const pages = await graph("/me/accounts", {
    access_token: ll.access_token,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100"
  });
  return (pages.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    token: p.access_token,
    igId: p.instagram_business_account ? p.instagram_business_account.id : null,
    igUsername: p.instagram_business_account ? p.instagram_business_account.username : null
  }));
}
async function postFacebook(meta, imageUrl, caption) {
  const d = await graph(`/${meta.pageId}/photos`, { url: imageUrl, caption, published: "true", access_token: meta.pageToken }, "POST");
  return d.post_id || d.id;
}
async function postInstagram(meta, imageUrl, caption) {
  const c = await graph(`/${meta.igId}/media`, { image_url: imageUrl, caption, access_token: meta.pageToken }, "POST");
  for (let i = 0; i < 10; i++) {
    const s = await graph(`/${c.id}`, { fields: "status_code", access_token: meta.pageToken });
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error("Instagram could not process the image");
    await new Promise((r) => setTimeout(r, 2e3));
  }
  const p = await graph(`/${meta.igId}/media_publish`, { creation_id: c.id, access_token: meta.pageToken }, "POST");
  return p.id;
}
function publicImageUrl(siteUrl, item) {
  return `${siteUrl.replace(/\/$/, "")}/api/img/${encodeURIComponent(item.imgKey)}.jpg`;
}
async function addLog(s, entry) {
  try {
    const log = await s.get("log", { type: "json" }) || [];
    log.unshift({ at: (/* @__PURE__ */ new Date()).toISOString(), ...entry });
    await s.setJSON("log", log.slice(0, 300));
  } catch (e) {
  }
}
async function runItem(s, item, siteUrl) {
  const meta = await s.get("meta", { type: "json" });
  if (!meta || !meta.pageToken) throw new Error("Instagram & Facebook are not connected yet");
  const url = publicImageUrl(siteUrl, item);
  item.results = item.results || {};
  for (const t of item.targets || []) {
    if (item.results[t] && item.results[t].ok) continue;
    try {
      const id = t === "ig" ? meta.igId ? await postInstagram(meta, url, item.captionIg || item.captionFb || "") : (() => {
        throw new Error("No Instagram account is linked to this Facebook Page");
      })() : await postFacebook(meta, url, item.captionFb || item.captionIg || "");
      item.results[t] = { ok: true, id, at: (/* @__PURE__ */ new Date()).toISOString() };
      await addLog(s, { key: item.key, target: t, ok: true, id });
    } catch (e) {
      item.results[t] = { ok: false, error: String(e.message || e), at: (/* @__PURE__ */ new Date()).toISOString() };
      await addLog(s, { key: item.key, target: t, ok: false, error: String(e.message || e) });
    }
  }
  const all = (item.targets || []).every((t) => item.results[t] && item.results[t].ok);
  item.attempts = (item.attempts || 0) + 1;
  item.status = all ? "posted" : item.attempts >= 3 ? "failed" : "retry";
  await s.setJSON(`queue/${item.key}`, item);
  return item;
}

// netlify/functions/api.mjs
var SAFE = /^[A-Za-z0-9_.|:-]{1,120}$/;
var CP1252 = { 128: 8364, 130: 8218, 131: 402, 132: 8222, 133: 8230, 134: 8224, 135: 8225, 136: 710, 137: 8240, 138: 352, 139: 8249, 140: 338, 142: 381, 145: 8216, 146: 8217, 147: 8220, 148: 8221, 149: 8226, 150: 8211, 151: 8212, 152: 732, 153: 8482, 154: 353, 155: 8250, 156: 339, 158: 382, 159: 376 };
function decode1252(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const part = bytes.subarray(i, i + 8192);
    s += String.fromCharCode.apply(null, Array.from(part, (b) => CP1252[b] || b));
  }
  return s;
}
function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/^data:[^,]+,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
var api_default = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const s = store();
  const siteUrl = env("URL") || url.origin;
  try {
    if (req.method === "GET" && parts[0] === "img" && parts[1]) {
      const key = parts[1].replace(/\.jpg$/, "");
      if (!SAFE.test(key)) return new Response("Not found", { status: 404 });
      const buf = await s.get(`img/${key}`, { type: "arrayBuffer" });
      if (!buf) return new Response("Not found", { status: 404 });
      return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
    }
    const auth = authorized(req);
    if (!auth.ok) return json({ error: auth.reason }, 401);
    if (parts[0] === "health") {
      const meta = await s.get("meta", { type: "json" });
      const { blobs } = await s.list({ prefix: "queue/" });
      return json({
        ok: true,
        connected: meta ? { page: meta.pageName, ig: meta.igUsername || null } : null,
        queued: blobs.length
      });
    }
    if (parts[0] === "state") {
      if (req.method === "GET") return json(await s.get("state", { type: "json" }) || { updatedAt: 0, state: null });
      if (req.method === "PUT") {
        const body = await req.json();
        if (!body || !body.state) return json({ error: "missing state" }, 400);
        await s.setJSON("state", { updatedAt: body.updatedAt || Date.now(), state: body.state });
        return json({ ok: true });
      }
    }
    if (parts[0] === "photo" && parts[1]) {
      if (!SAFE.test(parts[1])) return json({ error: "bad id" }, 400);
      if (req.method === "GET") {
        const d = await s.get(`photo/${parts[1]}`);
        return d ? new Response(d, { headers: { "content-type": "text/plain" } }) : json({ error: "not found" }, 404);
      }
      if (req.method === "PUT") {
        await s.set(`photo/${parts[1]}`, await req.text());
        return json({ ok: true });
      }
    }
    if (parts[0] === "photos" && req.method === "GET") {
      const { blobs } = await s.list({ prefix: "photo/" });
      return json({ ids: blobs.map((b) => b.key.slice(6)) });
    }
    if (parts[0] === "queue") {
      if (req.method === "GET" && !parts[1]) {
        const { blobs } = await s.list({ prefix: "queue/" });
        const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
        items.forEach((i) => {
          if (i) delete i.captionFb;
        });
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
          key: it.key,
          when: new Date(it.when).toISOString(),
          targets: (it.targets || ["fb", "ig"]).filter((t) => t === "fb" || t === "ig"),
          captionFb: it.captionFb || "",
          captionIg: it.captionIg || "",
          label: it.label || "",
          imgKey,
          status: "scheduled",
          attempts: 0,
          results: {}
        };
        await s.setJSON(`queue/${it.key}`, item);
        return json({ ok: true });
      }
      if (parts[1] && SAFE.test(parts[1])) {
        const item = await s.get(`queue/${parts[1]}`, { type: "json" });
        if (!item) return json({ error: "not found" }, 404);
        if (req.method === "DELETE") {
          await s.delete(`queue/${parts[1]}`);
          if (item.imgKey) await s.delete(`img/${item.imgKey}`);
          return json({ ok: true });
        }
        if (req.method === "POST" && parts[2] === "now") {
          item.attempts = 0;
          const done = await runItem(s, item, siteUrl);
          return json({ ok: done.status === "posted", item: done });
        }
      }
    }
    if (parts[0] === "srcbin" && req.method === "GET") {
      const pth = url.searchParams.get("path") || "";
      if (!/^Books\/[A-Za-z0-9]+\/[A-Za-z0-9_]+\.(zip|pdf)$/i.test(pth)) return json({ error: "bad path" }, 400);
      const ck = "srcbin/" + pth.toLowerCase();
      let buf = await s.get(ck, { type: "arrayBuffer" });
      if (!buf) {
        const r = await fetch("http://www.sriramchandra.org/" + pth, { headers: { "user-agent": "Mozilla/5.0 (DailyQuoteCards)" } });
        if (!r.ok) return json({ error: `sriramchandra.org returned ${r.status}` }, r.status === 404 ? 404 : 502);
        buf = await r.arrayBuffer();
        await s.set(ck, buf);
      }
      return new Response(buf, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store" } });
    }
    if (parts[0] === "src" && req.method === "GET") {
      const pth = url.searchParams.get("path") || "";
      if (!/^(Books\/[A-Za-z0-9]+\/[A-Za-z0-9]+chap_\d{1,3}\.htm|PeerlessPearls\/[A-Za-z]{3}\.htm)$/.test(pth)) return json({ error: "bad path" }, 400);
      const ck = "src/" + pth.toLowerCase();
      const cached = await s.get(ck, { type: "json" });
      const html200 = (h) => new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      if (cached && Date.now() - cached.at < 7 * 864e5) return html200(cached.html);
      const r = await fetch("http://www.sriramchandra.org/" + pth, { headers: { "user-agent": "Mozilla/5.0 (DailyQuoteCards)" } });
      if (!r.ok) return json({ error: `sriramchandra.org returned ${r.status}` }, r.status === 404 ? 404 : 502);
      const html = decode1252(new Uint8Array(await r.arrayBuffer()));
      await s.setJSON(ck, { at: Date.now(), html });
      return html200(html);
    }
    if (parts[0] === "log") return json({ log: await s.get("log", { type: "json" }) || [] });
    if (parts[0] === "connect" && req.method === "POST") {
      const body = await req.json();
      if (body.pageId) {
        const pending = await s.get("pendingPages", { type: "json" }) || [];
        const p = pending.find((x) => x.id === body.pageId);
        if (!p) return json({ error: "page not found" }, 400);
        await s.setJSON("meta", { pageId: p.id, pageName: p.name, pageToken: p.token, igId: p.igId, igUsername: p.igUsername, connectedAt: (/* @__PURE__ */ new Date()).toISOString() });
        await s.delete("pendingPages");
        return json({ ok: true, page: p.name, ig: p.igUsername });
      }
      const pages = await listPages(body);
      if (!pages.length) return json({ error: "This Facebook login manages no Pages. Make sure you selected your Page when creating the token." }, 400);
      if (pages.length === 1) {
        const p = pages[0];
        await s.setJSON("meta", { pageId: p.id, pageName: p.name, pageToken: p.token, igId: p.igId, igUsername: p.igUsername, connectedAt: (/* @__PURE__ */ new Date()).toISOString() });
        return json({ ok: true, page: p.name, ig: p.igUsername });
      }
      await s.setJSON("pendingPages", pages);
      return json({ choose: pages.map((p) => ({ id: p.id, name: p.name, igUsername: p.igUsername })) });
    }
    if (parts[0] === "disconnect" && req.method === "POST") {
      await s.delete("meta");
      return json({ ok: true });
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
};

// netlify/functions/autopost.mjs
var autopost_default = async () => {
  const s = store();
  const siteUrl = env("URL");
  const meta = await s.get("meta", { type: "json" });
  if (!meta || !siteUrl) return;
  const now = Date.now();
  const { blobs } = await s.list({ prefix: "queue/" });
  for (const b of blobs) {
    const item = await s.get(b.key, { type: "json" });
    if (!item || item.status === "posted" || item.status === "failed") continue;
    const due = new Date(item.when).getTime();
    if (due > now) continue;
    if (now - due > 12 * 3600 * 1e3 && item.status === "scheduled") {
      item.status = "failed";
      item.results = { ...item.results || {}, late: { ok: false, error: "Missed by more than 12 hours" } };
      await s.setJSON(b.key, item);
      continue;
    }
    await runItem(s, item, siteUrl);
  }
};

// cloudflare/entry.mjs
var knownUrl = null;
function setup(env2) {
  bindKV(env2.QUOTES);
  globalThis.Netlify = { env: { get: (k) => k === "URL" ? knownUrl || "" : env2[k] || "" } };
}
var entry_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env2.QUOTES) return new Response(JSON.stringify({ error: "Storage (KV) is not connected \u2014 check the kv_namespaces id in wrangler.jsonc" }), { status: 500, headers: { "content-type": "application/json" } });
      setup(env2);
      if (knownUrl !== url.origin) {
        knownUrl = url.origin;
        ctx.waitUntil((async () => {
          if (await env2.QUOTES.get("meta:siteUrl") !== url.origin) await env2.QUOTES.put("meta:siteUrl", url.origin);
        })());
      }
      return api_default(request);
    }
    return env2.ASSETS.fetch(request);
  },
  async scheduled(event, env2, ctx) {
    if (!env2.QUOTES) return;
    setup(env2);
    knownUrl = await env2.QUOTES.get("meta:siteUrl") || "";
    if (knownUrl) await autopost_default();
  }
};
export {
  entry_default as default
};
