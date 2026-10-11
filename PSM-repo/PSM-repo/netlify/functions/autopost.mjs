import { store, runItem, env, scoped } from "../lib/shared.mjs";

// Runs every 10 minutes. Posts every queued card whose time has come — for every signed-in user.
export default async () => {
  const base = store();
  const siteUrl = env("URL");
  if (!siteUrl) return;
  const users = (await base.get("users", { type: "json" })) || [];
  const spaces = users.map((ns) => scoped(base, "u/" + ns + "/"));
  if (!(await base.get("migrated"))) spaces.push(base); // data from before accounts existed
  const now = Date.now();
  for (const s of spaces) {
    const meta = await s.get("meta", { type: "json" });
    if (!meta) continue;
    const { blobs } = await s.list({ prefix: "queue/" });
    for (const b of blobs) {
      const item = await s.get(b.key, { type: "json" });
      if (!item || item.status === "posted" || item.status === "failed") continue;
      const due = new Date(item.when).getTime();
      if (due > now) continue;
      if (now - due > 12 * 3600 * 1000 && item.status === "scheduled") {
        item.status = "failed"; item.results = { ...(item.results || {}), late: { ok: false, error: "Missed by more than 12 hours" } };
        await s.setJSON(b.key, item); continue;
      }
      await runItem(s, item, siteUrl);
    }
  }
};

export const config = { schedule: "*/10 * * * *" };
