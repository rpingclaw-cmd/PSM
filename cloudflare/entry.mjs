// Cloudflare Worker: serves the site (static files), the /api routes, and runs autopilot every 10 minutes.
import api from "../netlify/functions/api.mjs";
import autopost from "../netlify/functions/autopost.mjs";
import { bindKV } from "./kvstore.mjs";

let knownUrl = null;
function setup(env) {
  bindKV(env.QUOTES);
  globalThis.Netlify = { env: { get: (k) => (k === "URL" ? knownUrl || "" : env[k] || "") } };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.QUOTES) return new Response(JSON.stringify({ error: "Storage (KV) is not connected — check the kv_namespaces id in wrangler.jsonc" }), { status: 500, headers: { "content-type": "application/json" } });
      setup(env);
      if (knownUrl !== url.origin) {
        knownUrl = url.origin;
        ctx.waitUntil((async () => { if ((await env.QUOTES.get("meta:siteUrl")) !== url.origin) await env.QUOTES.put("meta:siteUrl", url.origin); })());
      }
      return api(request);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    if (!env.QUOTES) return;
    setup(env);
    knownUrl = (await env.QUOTES.get("meta:siteUrl")) || "";
    if (knownUrl) await autopost();
  },
};
