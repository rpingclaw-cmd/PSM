// A tiny file-based store with the same shape as @netlify/blobs' getStore().
import fs from "node:fs/promises";
import path from "node:path";
const DIR = process.env.DATA_DIR || "/var/lib/quotecards";
const enc = (k) => encodeURIComponent(k).replace(/\./g, "%2E");
const dec = (f) => decodeURIComponent(f);
async function ensure() { await fs.mkdir(DIR, { recursive: true }); }
export const getStore = () => ({
  async get(key, opts = {}) {
    try {
      const buf = await fs.readFile(path.join(DIR, enc(key)));
      if (opts.type === "json") return JSON.parse(buf.toString("utf8"));
      if (opts.type === "arrayBuffer") return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return buf.toString("utf8");
    } catch (e) { if (e.code === "ENOENT") return null; throw e; }
  },
  async set(key, value) {
    await ensure();
    const data = typeof value === "string" ? value : Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value);
    const tmp = path.join(DIR, enc(key) + ".tmp" + process.pid);
    await fs.writeFile(tmp, data); await fs.rename(tmp, path.join(DIR, enc(key)));
  },
  async setJSON(key, value) { await this.set(key, JSON.stringify(value)); },
  async delete(key) { try { await fs.unlink(path.join(DIR, enc(key))); } catch (e) { if (e.code !== "ENOENT") throw e; } },
  async list({ prefix = "" } = {}) {
    await ensure();
    const files = await fs.readdir(DIR);
    return { blobs: files.filter((f) => !f.includes(".tmp")).map(dec).filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
  },
});
