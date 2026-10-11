# CLAUDE.md — Daily Quote Cards (repo: rpingclaw-cmd/PSM)

Read this first. Also read `HANDOVER.md` (history, accounts, decisions) and `docs/STUDIO_ENGINE_SPEC.md` (current work).

## Who / what
Pranahuti Yoga outreach app (Instagram, Facebook, WhatsApp channel "Divine Light Meditation"): daily
Samadristi quote cards, Reels, Source bank (new quotes from sriramchandra.org books), Autopilot posting,
and Studio (long talk / podcast editor). The owner is **not a programmer**: explain in plain words, give
exact clicks, never leave them with half-finished state. Spiritual content: quotes must stay **word-for-word**.

## Live system
- App: https://psm.dailyquotecards.workers.dev — Cloudflare Worker `psm` (free plan), auto-deploys on every push
  to `main` via Workers Builds (`npx wrangler deploy`, 500 builds/month).
- Storage: Cloudflare KV `QUOTES` (id in wrangler.jsonc). Per-user data under `u/<ns>/…`; owner ns = `owner`.
- Secrets (Cloudflare dashboard, type Secret): `QUOTEAPP`, `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, optional `ALLOWED_EMAILS`.
- Google sign-in: Google Cloud project "Daily Quote Cards", Testing mode (test users only).

## Repo layout & build (IMPORTANT)
- **Edit `src/`, never hand-edit `public/index.html`.** Then run `python3 tools/build.py` (assembles the single-file app:
  head + CSS + embedded fonts + body + JS in order pre.js → themes2.js → draw.js → post.js → engine.js → studio2.js → studio3.js → studio4.js → editor.js).
- `netlify/functions/api.mjs`, `netlify/functions/autopost.mjs`, `netlify/lib/shared.mjs` = server logic (shared by all hosts).
- After any server change, rebuild the Worker bundle (committed file):
  `npx esbuild cloudflare/entry.mjs --bundle --format=esm --platform=neutral --target=es2022 --outfile=cloudflare/worker.js --alias:@netlify/blobs=./cloudflare/kvstore.mjs`
- `server/` = self-host Node version (rebuild with `--alias:@netlify/blobs=./server/filestore.mjs`, entry `server/entry.mjs`).
- Local test: `npx wrangler dev` (put `QUOTEAPP=…` in `.dev.vars`, never commit it) or run `node server/server.mjs`
  with `DATA_DIR=/tmp/x QUOTEAPP=secret`.

## Studio Engine (`engine/`)
- Local helper the owner runs on their own computer (Python 3.13 via `uv`, FastAPI on 127.0.0.1:8765, ffmpeg,
  DeepFilterNet `deep-filter` binary). Browser side: `src/engine.js` (Studio tab). Pairing token arrives as
  `#engine=<token>` when the engine opens the site; requests carry `X-Engine-Token`.
- Jobs: report, prepare, sync, clean, preview, analyse (Silero VAD voice map), faces (YuNet), frame (preview still),
  thumbs, render (pieces with framing / punch-ins / covers + dissolves, then QC: lip sync at 3 points, loudness,
  black/frozen picture, captions; exports VTT, FCPXML, EDL, project). Steps are resumable (`*.done.json` next to
  outputs in `studio_work/`). Browser side: `src/engine.js` (connection, jobs), `src/studio2.js` (transcript
  line-up, sound map, chapters), `src/studio3.js` (picture, covers, word captions), `src/studio4.js` (YouTube, thumbs). `src/editor.js` = full-screen DaVinci Resolve-style editor (timeline canvas, Media/Edit/Color/Fairlight/Deliver pages; it moves the guided fieldsets into its panels and back; hand cuts = `STU.manualCuts` used by `keepSegments`, blade points = `STU.splits`, undo/redo wraps `stuSave`). Owner installs with `engine/install.ps1` (Windows) / `engine/install.sh` (Mac), which download
  the engine from this repo's `main` branch — so engine changes reach the owner when they re-run the installer.
- Tests: `cd engine && STUDIO_DEEP_FILTER=/path/to/deep-filter STUDIO_TEST_FACE=/path/face.jpg uv run pytest -q tests`
  (synthetic media + espeak-ng voice with a known answer; sync and lip sync < 5 ms; face tests skip without a face photo),
  `node tools/tests/test_studio2.mjs`, `node tools/tests/test_studio3.mjs`, and the browser test
  `tools/tests/studio_ui_test.py` (Playwright; see its header). CI runs the first three on GitHub (no DeepFilterNet).
- Owner's machine: Windows 11 laptop, i7-8550U (4 cores), 16 GB, NVIDIA 940MX (no NVENC) + Intel UHD 620 (Quick Sync),
  Smart App Control may be on. Keep defaults light (1080p renders, CPU-friendly).

## Rules
1. Test before every push (Playwright for UI flows; real ffmpeg for Studio renders). Don't push untested code — every
   push goes live for real users.
2. Batch changes into few commits/pushes. Commit messages in plain English.
3. Never commit secrets, keys, tokens or `.dev.vars`.
4. Sync model is **merge, not overwrite** (`mergeStates` in post.js with tombstones). Keep it that way.
5. Keep free-tier limits in mind: KV ~1,000 writes/day, Worker 10 ms CPU per request.
6. Browser code is plain JavaScript (no framework, no build step besides tools/build.py). Keep it that way unless asked.
7. Heavy media work runs on the user's computer (ffmpeg / Studio Engine), never in the cloud.
8. When unsure about a fact (prices, APIs, model names), check documentation; don't guess.

## Current priority
Build the **Studio Engine** — see `docs/STUDIO_ENGINE_SPEC.md`.
