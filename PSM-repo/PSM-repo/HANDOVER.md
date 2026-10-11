# Daily Quote Cards — project handover (for a new chat)

Paste or attach this file (plus `daily-quote-cards-full.zip`) at the start of a new chat and say:
"Continue this project. Next step: test the Studio tab."

---

## 1. What this is
A web app for Pranahuti Yoga outreach (Instagram, Facebook, WhatsApp channel *Divine Light Meditation*):
daily Samadristi-style quote cards from the Masters' books, Reels, a quote "Source bank", autopilot posting,
and a Studio tab for editing long talks/podcasts. Built in this chat by Claude; owner is non-technical-friendly.

## 2. Where everything lives
| Thing | Location |
|---|---|
| **Live app** | https://psm.dailyquotecards.workers.dev (Cloudflare Worker named **psm**) |
| **Code (GitHub)** | https://github.com/rpingclaw-cmd/PSM (public repo, branch `main`) |
| **Hosting** | Cloudflare (free) — account subdomain `dailyquotecards.workers.dev`, account id `c374923d3efd3a66cddd876e84c09bab` |
| **Storage** | Cloudflare KV namespace `quotecards`, id `7d3b741fda644d1f8e2e1ed539b0cc7d`, bound as `QUOTES` |
| **Owner Google account** | pranahutiyogameditationsjsu@gmail.com |
| **Google sign-in** | Google Cloud project "Daily Quote Cards" → Google Auth Platform, **Testing** mode, 2 test users added. Client ID `878036582317-mkifk2a5iam8hn09gcegc8hse16cuma8.apps.googleusercontent.com`. Publishing needs a homepage + privacy policy page (not done). |
| **Cloudflare variables (all Secret)** | `QUOTEAPP` (owner app password), `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`; optional `ALLOWED_EMAILS` |
| Old/unused | Netlify site daily-quote-cards.netlify.app (free credits ran out — paused updates); Oracle Cloud account `pranahutiyogameditations` (no server — "out of capacity" in San Jose); DuckDNS `dailyquotecards.duckdns.org` (unused) |

**How updates go live:** upload changed files to GitHub at the right folder → Cloudflare auto-builds
(`npx wrangler deploy`, ~1 min, 500 free builds/month). Upload links:
- `public/index.html` → https://github.com/rpingclaw-cmd/PSM/upload/main/public
- `cloudflare/worker.js` → https://github.com/rpingclaw-cmd/PSM/upload/main/cloudflare
- `wrangler.jsonc` → https://github.com/rpingclaw-cmd/PSM/upload/main
Lessons: rename `index (1).html` → `index.html`; upload one file per link (wrong-folder uploads happened often);
uploading the same name replaces the file (don't delete first); then Ctrl+Shift+R in the browser.

## 3. Code structure (repo = the zip)
- **`src/` = the real source** (head.html, style.css, extra.css, fonts/, body.html, pre.js, themes2.js, draw.js, post.js).
  Build with `python3 tools/build.py` → `public/index.html` (verified byte-identical to the live app).
- `CLAUDE.md` = rules for Claude Code; `docs/STUDIO_ENGINE_SPEC.md` = the current build plan.
- `public/index.html` — the entire app (≈1.1 MB single file: HTML/CSS/JS, fonts embedded as base64).
- `netlify/functions/api.mjs`, `netlify/functions/autopost.mjs`, `netlify/lib/shared.mjs` — server logic
  (written once, reused everywhere via a storage adapter).
- `cloudflare/worker.js` — **pre-bundled** Worker (built with esbuild from `cloudflare/entry.mjs` + the netlify
  files, alias `@netlify/blobs` → `cloudflare/kvstore.mjs`). Must be rebuilt after server changes:
  `npx esbuild cloudflare/entry.mjs --bundle --format=esm --platform=neutral --target=es2022 --outfile=cloudflare/worker.js --alias:@netlify/blobs=./cloudflare/kvstore.mjs`
- `wrangler.jsonc` — name, assets dir `./public`, KV binding, cron `*/10 * * * *`, `keep_vars: true`.
- `server/` — self-host version (Node + file storage + `setup.sh` for Ubuntu/Caddy) — prepared for Oracle, unused.
- Docs: `README.md` (Netlify + Meta setup), `CLOUDFLARE.md`, `SELF-HOSTING.md`.

## 4. App features (tabs)
- **Today** — two daily posts: 3:30 PM Babuji (landscape, classic), 7:30 PM Dr K.C. Varadachari (portrait, modern).
  Share card+caption (WhatsApp), Insta/FB caption, Story, Reel, Mark posted, calendar reminders (.ics).
  Caption format: `quote ~ Babuji Maharaj` / `quote – Dr K. C. Varadachari` (editable per master).
- **Card** — designer: 18 backgrounds, Surprise me, 4 sizes, classic/modern layouts, 15 header fonts, header
  wording/background/size/colour, name & website size/colour, photo strip (many photos per master), shapes.
  **Make Reel video**: options — show/hide date header, opening line, 7 generated music styles or own audio
  (start point, volume), animation (lines/words/typewriter/all), length 8–30 s, closing message, safe zone.
- **Month** — fill empty days from library (per post time), shuffle looks & photos, zip download (+captions.txt, stories).
- **Library** — quotes with citation and optional link; Excel export.
- **Find quotes** — books (PDF/text, chunked), audio talks (Groq Whisper transcription), page photos, pasted text.
  Multi-AI fallback: Gemini → Mistral → Cerebras → Groq → OpenRouter (keys in Setup). Verbatim check.
- **Source bank** — new quotes straight from sriramchandra.org books (Basic Writings parts: Efficacy of Raja Yoga ch3–10,
  Ten Commandments 12–21, Reality at Dawn 22–31, Towards Infinity 34–36; Showers of Divine Grace 1–43;
  Silence Speaks 1–26; KCV Vol 1 1–66; custom books; own PDFs), skips the 365 Peerless Pearls quotes,
  exact-wording only, deep links with text-fragment highlight, Excel with Trainer 1–5 sheets.
  **Auto-continues by itself** after AI limits/errors until the target (e.g. 500) — keep tab open.
  Progress so far: ~206 quotes found (owner's account). SDG page numbers auto from official PDF;
  BWS page numbers need the Basic Writings PDF (not yet provided) or estimation (offered, not built).
- **Studio** (new) — talk/podcast editor. Browser: sync separate recorder ↔ video (FFT cross-correlation,
  drift correction; tested <1 ms on 60-min simulation), transcription (Groq whisper-large-v3 word timestamps,
  Gemini fallback), edit by striking words, filler/pause removal, AI reel suggestions, captions (SRT/ASS).
  Heavy work by **ffmpeg on the user's computer** via generated scripts (Windows .bat / Mac .command):
  `1-prepare` (16 kHz WAVs + ffprobe JSON, optional preview) and `2-render` (clean+sync audio, per-segment 4K encode,
  concat, podcast MP3, reels 1080×1920 with burned captions; HDR→SDR tonemap; GPU options).
  Audio presets: light/standard/strong (arnndn model downloaded)/loudness; denoiser latency compensated (25/35 ms).
  Tested end-to-end on Linux with real ffmpeg; Windows .bat reviewed but not executed.
- **Autopilot** — schedules cards to Facebook Page + Instagram via Meta Graph API v25 (server cron every 10 min).
  **Not yet connected** (needs Meta developer app + token — README step 4).
- **Setup** — Account & sync (Sign in with Google; app password fallback), AI keys (synced to the account),
  post times, Insta/FB caption extra, Lalaji Era calendar (automatic: year starts Jan 14; 31-day months
  Samavarti, Prabhu, Iswar, Varada, Krishna; Prana +1 in leap years), masters & photos, website, backup/restore.

## 5. Accounts & sync (just finished)
- Each Google account = its own private space on the server (`u/<id>/…` in KV); owner email → space `owner`
  (old pre-account data auto-migrated there). Keys + work sync across devices (45 s polling + on focus).
- Test users are added in Google Cloud → Google Auth Platform → Audience → Test users (max 100 in Testing).
- Owner confirmed signed in. Verified: live `/api/config` returns the Client ID.

## 6. Next steps (in order)
0. **Build the Studio Engine** with Claude Code — see `docs/STUDIO_ENGINE_SPEC.md` (stages 1–4).
   Source bank was at ~381/500 and auto-continuing; sync now merges (no more lost quotes; Restore from Excel exists).
1. **Test Studio** with a 10-minute clip (`ffmpeg -t 600 -i "Video.MOV" -c copy "test video.MOV"`, same for audio),
   run 1-prepare, load studio_out, sync, transcribe, edit, render. Needs ffmpeg installed (`winget install Gyan.FFmpeg`)
   and ~10 GB free (laptop is low on space → Mac or external drive). Then the full 1-hour 4K video (≈45 GB free needed).
2. Continue Source bank to 500 → Download Excel → send to 5 trainers.
3. Connect Instagram & Facebook for Autopilot (Meta developer app; IG must be Professional + linked to FB Page).
4. Basic Writings PDF for BWS page numbers (or build page-number estimation from Peerless Pearls markers).
5. Optional: privacy-policy page + Branding to publish Google sign-in publicly; nicer domain (e.g. quotes.pranahutiyoga.org).
6. Clean up: delete old Netlify site; Oracle not needed.

## 7. Ideas agreed for later
Studio: styled word-by-word captions, YouTube titles/chapters, quote cards from talks, intro/outro, speaker labels,
translated captions. App: trainer review (✓/✗) inside the app, Telugu/Hindi captions, WhatsApp channel scheduling
when WhatsApp releases it (no official Channels API; unofficial bots risk bans).
