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

/* ---------- accounts ---------- */
const enc = new TextEncoder();
const b64urlToBytes = (str) => { const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
let jwksCache = { at: 0, keys: [] };
/* Verify a Google "Sign in with Google" ID token (RS256) and return its claims. */
export async function verifyGoogle(token, clientId) {
  const [h, p, sig] = String(token || "").split(".");
  if (!h || !p || !sig) throw new Error("Bad sign-in token");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (Date.now() - jwksCache.at > 3600e3 || !jwksCache.keys.find((k) => k.kid === header.kid)) {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs"); jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown Google key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), enc.encode(h + "." + p));
  if (!ok) throw new Error("Sign-in token signature is not valid");
  if (claims.aud !== clientId) throw new Error("Sign-in token is for a different app");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new Error("Sign-in token is not from Google");
  if (claims.exp * 1000 < Date.now()) throw new Error("Sign-in expired — please sign in again");
  if (!claims.email || claims.email_verified === false) throw new Error("Your Google email is not verified");
  return claims;
}
export function randomToken() { const a = new Uint8Array(32); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }
/* A store view whose keys all live under one user's private prefix. */
export function scoped(base, prefix) {
  return {
    get: (k, o) => base.get(prefix + k, o),
    set: (k, v) => base.set(prefix + k, v),
    setJSON: (k, v) => base.setJSON(prefix + k, v),
    delete: (k) => base.delete(prefix + k),
    async list(o = {}) { const r = await base.list({ prefix: prefix + (o.prefix || "") }); return { blobs: r.blobs.map((b) => ({ key: b.key.slice(prefix.length) })) }; },
  };
}
const SYSTEM = /^(u\/|sess\/|img\/|src\/|srcbin\/|meta:|users$|migrated$|pendingPages$)/;
/* First time the owner's space is used, copy the data saved before accounts existed. */
export async function migrateLegacy(base) {
  if (await base.get("migrated")) return;
  const { blobs } = await base.list({ prefix: "" });
  for (const b of blobs) {
    if (SYSTEM.test(b.key)) continue;
    const v = await base.get(b.key, { type: "arrayBuffer" });
    if (v != null && !(await base.get("u/owner/" + b.key))) await base.set("u/owner/" + b.key, v);
  }
  await base.set("migrated", new Date().toISOString());
}
export async function registerUser(base, ns) {
  const users = (await base.get("users", { type: "json" })) || [];
  if (!users.includes(ns)) { users.push(ns); await base.setJSON("users", users); }
}
/* Who is calling? Google session (Bearer token) or the owner's app password. */
export async function resolveUser(req, base) {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const sess = await base.get("sess/" + auth.slice(7).trim(), { type: "json" });
    if (!sess || sess.exp < Date.now()) return { ok: false, reason: "Please sign in again" };
    if (sess.ns === "owner") await migrateLegacy(base);
    return { ok: true, ns: sess.ns, email: sess.email, name: sess.name, token: auth.slice(7).trim() };
  }
  if (!req.headers.get("x-app-password")) return { ok: false, reason: "Please sign in with Google" };
  const pw = authorized(req);
  if (pw.ok) { await migrateLegacy(base); await registerUser(base, "owner"); return { ok: true, ns: "owner", email: env("OWNER_EMAIL") || "owner", name: "Owner" }; }
  return pw;
}

export function authorized(req) {
  const pw = String(env("APP_PASSWORD") || env("QUOTEAPP") || "").trim();
  if (!pw) return { ok: false, reason: "Please sign in with Google (or set the QUOTEAPP password on the server)" };
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
  try {
    const log = (await s.get("log", { type: "json" })) || [];
    log.unshift({ at: new Date().toISOString(), ...entry });
    await s.setJSON("log", log.slice(0, 300));
  } catch (e) { /* the log is optional — never let it stop a post */ }
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
