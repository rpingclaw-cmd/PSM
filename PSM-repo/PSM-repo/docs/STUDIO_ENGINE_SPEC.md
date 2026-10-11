# Studio Engine — specification (build in stages, test each on real footage)

Goal: replace DaVinci Resolve Studio, Descript, Premiere, Topaz, TimeBolt, MacWhisper, WhisperX, Auto-Editor,
HandBrake, MediaInfo for our use — **free, local, private, paid-tool quality** — controlled from the Studio tab.

## Source material (owner's real project)
- iPhone video: 2160×3840 (vertical 4K), ~1:00:38, 21.3 GB, likely HEVC, possibly HDR (HLG) and variable frame rate.
- Separate audio recording: ~57:58, 28.6 MB.
- Known issue: the first ~1 minute of video is missing/unusable → cover it with borrowed footage (audio keeps playing).
- Owner has an **accurate transcript** of the talk to use for wording.
- Outputs wanted: horizontal 16:9 YouTube video (1080p), podcast audio, vertical Reels with captions, captions file.

## Architecture
- **Studio Engine** = local helper on the user's Mac/PC: **Python 3.11+ managed by `uv`** (one-command install),
  plus ffmpeg. Runs a small **localhost HTTP server** (e.g. FastAPI on 127.0.0.1:8765) with job queue, progress
  (Server-Sent Events), resumable jobs, logs. The website's Studio tab detects it ("Engine connected ✓") and sends jobs;
  if the engine is not running, the existing script-download flow still works (keep it as fallback).
- Allow the site origin via CORS (only https://psm.dailyquotecards.workers.dev and localhost) + a random pairing token.
- Detect hardware: Apple Silicon (MPS/CoreML, VideoToolbox), NVIDIA (CUDA, NVENC), else CPU. Pick models accordingly.
- Never upload media anywhere. Work folder next to the video: `studio_work/` (cache, proxies, intermediate files).
- Installer: `install.sh` (Mac) / `install.ps1` (Windows): installs uv, ffmpeg (Homebrew / winget), model weights;
  creates a "Start Studio Engine" shortcut. Must work for a non-programmer.

## Open-source components (verify current versions + licenses before use)
| Need | Component | Notes |
|---|---|---|
| Diagnostics, VFR→CFR, encode | ffmpeg / ffprobe (+ MediaInfo-style report) | already used; HDR→SDR tonemap via zscale |
| Voice isolation / denoise | **DeepFilterNet 3** (Rikorose/DeepFilterNet) | main denoiser; full-band 48 kHz |
| "Studio sound" polish (optional) | **resemble-enhance** (resemble-ai) | denoise + enhancement; slower; A/B with DeepFilterNet |
| De-reverb (room echo) | evaluate DeepFilterNet strength / resemble-enhance / WPE (nara_wpe) | pick best on real audio |
| Transcription | **faster-whisper** (large-v3) or whisper.cpp on Mac | local, no limits |
| Forced alignment of the owner's transcript | **WhisperX** alignment (wav2vec2) — or ctc-forced-aligner | exact text → word timestamps |
| Silence / filler removal | our editor + **auto-editor** (WyattBlue/auto-editor) logic | also FCPXML export |
| Speaker framing (smart reframe) | **MediaPipe** face detection (or YOLO-face) + smoothing | single speaker; smooth crop path |
| Upscaling (only if needed) | **Real-ESRGAN** (ncnn-vulkan build) | 2160×1215 crop is already enough for 1080p — make optional |
| Loudness | ffmpeg loudnorm two-pass | −16 LUFS podcast, −14 LUFS online, true peak −1.5 dB |

## Features (must-have, in this order)
### Stage 1 — Foundation + audio (test: 10-min clip, then full hour)
1. Engine install + "connected" status in Studio tab; hardware report; job progress & cancel; resumable jobs.
2. Media report (MediaInfo-like): codec, HDR, VFR, rotation, duration mismatch between files, audio level/clipping.
3. Proxy: 540p CFR H.264 for smooth preview in the browser (generated automatically).
4. Sync (already in browser) — move/duplicate into engine for speed; keep 2-point drift correction;
   **automatic QC report: measured lip-sync offset at start / middle / end of the final render** (must be < 20 ms).
5. Audio: DeepFilterNet voice isolation (strength slider), EQ (high-pass, presence), de-esser, gentle compression,
   two-pass loudness (choice −16 / −14 LUFS), room-tone fill for cut gaps (no dead silence), A/B preview 30 s before/after.
### Stage 2 — Text editing with the accurate transcript
6. Paste/upload owner's accurate transcript → **forced alignment** to the cleaned audio → transcript in editor uses
   the owner's exact words with word timings. Flag low-confidence regions for review.
7. Edit by deleting text (existing), filler/silence removal (existing + auto-editor-quality detection),
   keep natural breaths option, minimum pause setting, J/L-cut style audio crossfades (no clicks).
8. Chapters (YouTube timestamps) suggested by AI from the transcript; editable.
### Stage 3 — Picture
9. **Cover / B-roll ranges**: choose a timeline range (e.g. 0:00–1:00) to cover with video taken from elsewhere in the
   recording (auto-suggest moments where the speaker is listening / not talking, using face + voice activity), audio
   continues underneath; cross-dissolves; optional slow zoom or title card.
10. **Vertical → horizontal 16:9** (1920×1080 out): MediaPipe face tracking → smoothed crop path (no jitter, lead room),
    **alternating punch-ins (100% ↔ ~118%) at every cut** to hide jump cuts; manual override per section.
    Option: blurred-pillarbox layout. Apply same framing rules to borrowed intro footage.
11. Vertical Reels 9:16 from the same edit with face-centred framing; styled word-by-word captions (karaoke highlight),
    safe zones for Instagram UI.
12. Basic colour: auto exposure/white balance match between sections, sliders (brightness, contrast, warmth, saturation).
13. Optional Real-ESRGAN upscale when output > source crop.
### Stage 4 — Output & polish
14. Exports: YouTube 16:9 (H.264 1080p or 4K), podcast (MP3 + WAV), Reels, SRT/VTT captions, chapters text,
    **FCPXML/EDL for DaVinci Resolve Free** (so a human can fine-tune), project file. Hardware encoders when available.
15. YouTube package: AI title options, description with chapters, tags, thumbnail frame suggestions (face + clarity score).
16. Final QC report: lip-sync at 3 points, loudness measured, true peak, duration, black frames, frozen frames,
    caption timing check. Show ✓/⚠ before the owner uploads.

## Acceptance tests (automate where possible)
- Synthetic: offset+drift recorder vs camera → render → measured sync < 5 ms at start/mid/end (existing test harness idea).
- Real: owner's 10-min clip → listen test before/after DeepFilterNet; transcript alignment ≥ 98% words aligned.
- 16:9 reframe: face stays inside central third ≥ 95% of frames; no crop jumps > 3% per frame except at cuts.
- Full 1-hour run completes on owner's machine; resumes after interruption.

## Do NOT
- Upload media to any cloud service. Break the existing browser-only flow. Add paid dependencies.
- Change quote wording anywhere (spiritual texts must be verbatim).
