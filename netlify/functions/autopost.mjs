import { store, runItem } from "../lib/shared.mjs";

// Runs every 10 minutes. Posts every queued card whose time has come.
export default async () => {
  const s = store();
  const siteUrl = process.env.URL;
  const meta = await s.get("meta", { type: "json" });
  if (!meta || !siteUrl) return;
  const now = Date.now();
  const { blobs } = await s.list({ prefix: "queue/" });
  for (const b of blobs) {
    const item = await s.get(b.key, { type: "json" });
    if (!item || item.status === "posted" || item.status === "failed") continue;
    const due = new Date(item.when).getTime();
    if (due > now) continue;
    if (now - due > 12 * 3600 * 1000 && item.status === "scheduled") { // too late — don't post yesterday's card
      item.status = "failed"; item.results = { ...(item.results || {}), late: { ok: false, error: "Missed by more than 12 hours" } };
      await s.setJSON(b.key, item); continue;
    }
    await runItem(s, item, siteUrl);
  }
};

export const config = { schedule: "*/10 * * * *" };
