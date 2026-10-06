import { getStore } from "@netlify/blobs";

/* Read a Netlify environment variable (works in every function runtime). */
export function env(name) {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name); if (v) return v; } catch (e) {}
  return (typeof process !== "undefined" && process.env && process.env[name]) || "";
}

export const graphBase = () => `https://graph.facebook.com/${env("GRAPH_VERSION") || "v25.0"}`;
export const store = () => getStore({ name: "quotecards", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function authorized(req) {
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
    const e = new Error((d.error && d.error.message) || `Meta error ${r.status}`);
    e.meta = d.error || null;
    throw e;
  }
  return d;
}

/* Exchange a short-lived user token for a long-lived one, then list the Pages it manages. */
export async function listPages({ appId, appSecret, userToken }) {
  const ll = await graph("/oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: userToken,
  });
  const pages = await graph("/me/accounts", {
    access_token: ll.access_token,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  return (pages.data || []).map((p) => ({
    id: p.id, name: p.name, token: p.access_token,
    igId: p.instagram_business_account ? p.instagram_business_account.id : null,
    igUsername: p.instagram_business_account ? p.instagram_business_account.username : null,
  }));
}

export async function postFacebook(meta, imageUrl, caption) {
  const d = await graph(`/${meta.pageId}/photos`, { url: imageUrl, caption, published: "true", access_token: meta.pageToken }, "POST");
  return d.post_id || d.id;
}

export async function postInstagram(meta, imageUrl, caption) {
  const c = await graph(`/${meta.igId}/media`, { image_url: imageUrl, caption, access_token: meta.pageToken }, "POST");
  for (let i = 0; i < 10; i++) {
    const s = await graph(`/${c.id}`, { fields: "status_code", access_token: meta.pageToken });
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error("Instagram could not process the image");
    await new Promise((r) => setTimeout(r, 2000));
  }
  const p = await graph(`/${meta.igId}/media_publish`, { creation_id: c.id, access_token: meta.pageToken }, "POST");
  return p.id;
}

export function publicImageUrl(siteUrl, item) {
  return `${siteUrl.replace(/\/$/, "")}/api/img/${encodeURIComponent(item.imgKey)}.jpg`;
}

export async function addLog(s, entry) {
  const log = (await s.get("log", { type: "json" })) || [];
  log.unshift({ at: new Date().toISOString(), ...entry });
  await s.setJSON("log", log.slice(0, 300));
}

/* Post one queued item to its targets. Updates the item in storage. */
export async function runItem(s, item, siteUrl) {
  const meta = await s.get("meta", { type: "json" });
  if (!meta || !meta.pageToken) throw new Error("Instagram & Facebook are not connected yet");
  const url = publicImageUrl(siteUrl, item);
  item.results = item.results || {};
  for (const t of item.targets || []) {
    if (item.results[t] && item.results[t].ok) continue;
    try {
      const id = t === "ig"
        ? (meta.igId ? await postInstagram(meta, url, item.captionIg || item.captionFb || "") : (() => { throw new Error("No Instagram account is linked to this Facebook Page"); })())
        : await postFacebook(meta, url, item.captionFb || item.captionIg || "");
      item.results[t] = { ok: true, id, at: new Date().toISOString() };
      await addLog(s, { key: item.key, target: t, ok: true, id });
    } catch (e) {
      item.results[t] = { ok: false, error: String(e.message || e), at: new Date().toISOString() };
      await addLog(s, { key: item.key, target: t, ok: false, error: String(e.message || e) });
    }
  }
  const all = (item.targets || []).every((t) => item.results[t] && item.results[t].ok);
  item.attempts = (item.attempts || 0) + 1;
  item.status = all ? "posted" : item.attempts >= 3 ? "failed" : "retry";
  await s.setJSON(`queue/${item.key}`, item);
  return item;
}
