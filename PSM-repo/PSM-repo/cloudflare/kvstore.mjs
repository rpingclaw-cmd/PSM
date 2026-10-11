// Cloudflare KV with the same shape as @netlify/blobs' getStore().
let KV = null;
export function bindKV(kv) { KV = kv; }
export const getStore = () => ({
  async get(key, o = {}) {
    if (o.type === "json") return await KV.get(key, "json");
    if (o.type === "arrayBuffer") return await KV.get(key, "arrayBuffer");
    return await KV.get(key, "text");
  },
  async set(key, value) { await KV.put(key, value); },
  async setJSON(key, value) { await KV.put(key, JSON.stringify(value)); },
  async delete(key) { await KV.delete(key); },
  async list({ prefix = "" } = {}) {
    const blobs = []; let cursor;
    do { const r = await KV.list({ prefix, cursor }); for (const k of r.keys) blobs.push({ key: k.name }); cursor = r.list_complete ? null : r.cursor; } while (cursor);
    return { blobs };
  },
});
