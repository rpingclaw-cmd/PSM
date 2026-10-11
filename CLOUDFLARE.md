# Daily Quote Cards on Cloudflare (free)

## 1. Create storage (2 min)
Cloudflare dashboard → **Storage & databases → Workers KV** (or **KV**) → **Create instance / Create namespace**
→ name it `quotecards` → **Create**. Copy its **ID** (a long code of letters and numbers).

## 2. Put the Cloudflare files on GitHub (3 min)
- `wrangler.jsonc` → upload to the **main folder** of PSM: `https://github.com/rpingclaw-cmd/PSM/upload/main`
- `worker.js` → upload to a new **cloudflare** folder: `https://github.com/rpingclaw-cmd/PSM/upload/main/cloudflare`
Then open `wrangler.jsonc` on GitHub → ✏️ (Edit) → replace `PASTE_YOUR_KV_ID_HERE` with your ID → **Commit changes**.

## 3. Connect GitHub to Cloudflare (5 min)
**Compute → Workers & Pages → Create → Import a repository** → connect **GitHub** → choose **PSM**.
- Project name: `daily-quote-cards` (must match exactly)
- Build command: leave empty
- Deploy command: `npx wrangler deploy`
→ **Create and deploy**. Wait until it says **Success**.

## 4. Add your password (1 min)
Open the **daily-quote-cards** Worker → **Settings → Variables and Secrets → Add**
→ Type **Secret**, Name `QUOTEAPP`, Value: your password → **Deploy**.

## 5. Use it
Open the address shown on the Worker page (like `https://daily-quote-cards.YOURNAME.workers.dev`).
Setup → App password → **Connect** → Restore backup → paste AI keys → connect Instagram & Facebook.

Updates: upload to GitHub as before — Cloudflare deploys automatically (500 free per month).
Autopilot runs every 10 minutes automatically.
