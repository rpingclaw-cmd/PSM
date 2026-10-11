# Studio Engine — how to use it (plain steps)

The Studio Engine is a free helper program that runs **on your own computer**. The website's Studio tab
sends it work (check files, clean the sound, sync, make the final videos) and shows the progress.
Your video never leaves your computer.

## 1. Install (once, 5–15 minutes)

**Windows**
1. Right-click the **Start** button (the Windows logo) → click **Terminal** (or **Windows PowerShell**).
2. Copy this line, paste it into that window (right-click pastes) and press **Enter**:

   `irm https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/engine/install.ps1 | iex`
3. Wait until it says **All done!** It installs: uv (Python manager), ffmpeg (video tool),
   DeepFilterNet (AI voice isolation) and the engine itself.
4. The website opens by itself and the Studio tab shows **Engine connected ✓**.
   If the browser asks to *access other apps and services on this device*, click **Allow**.

**Mac**: open **Terminal**, paste
`curl -fsSL https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/engine/install.sh | bash` and press **Return**.

**Update** the engine later: run the same line again.

## 2. Every time

1. Double-click **Start Studio Engine** on your desktop. A black window opens — keep it open
   (you can minimise it). The website opens and connects.
2. To stop the engine, close that black window.

## 3. Editing a talk (Studio tab)

1. **Your files** — tick *I recorded the audio separately* if you used a recorder. Click **Choose video…**
   and **Choose separate audio…** (the window may open behind the browser). Click **Check files** to see a
   report (HDR, frame rate, length difference, clipping, free disk space).
2. Click **Prepare** — makes a small preview copy and the sound files used for sync (a few minutes per hour of video).
3. **Sync** — click **Find sync automatically**. It checks the start, middle and end and tells you the error
   (should be well under 20 ms).
4. **Clean the sound** — set the voice isolation slider, click **Preview 30 s before / after**, listen, adjust.
5. **Transcribe** (free Groq key in Setup). Then paste **your accurate transcript** (or load the .txt/.docx file)
   and press **Line up my transcript with the recording**: the editor now shows *your exact words*, each at the
   right moment. Orange-underlined words are worth a quick check (**Next word to check ▸** jumps there);
   grey words were spoken but are not in your text (um, repeats) and are cut automatically.
6. **Edit by text** — press **Listen for pauses, breaths and missed “um”s**: the engine maps where the voice is, so
   every cut lands on the quietest moment, long pauses are shortened by what you actually hear, natural breaths
   are kept, and short sounds without words appear as grey [sound] items you can keep or cut.
   *Smooth cuts* cross-fades the sound at every cut (40 ms is a good default).
7. **Reels & chapters** — ✨ suggests Reels and YouTube chapters; edit the titles. Chapter times follow your edits.
8. **Picture** — press **Find the speaker**. Choose the shape: *YouTube 16:9 — follows the speaker* (recommended
   for your vertical iPhone video), *16:9 with blurred sides*, or *same as recorded*. *Close-up at every cut* hides
   jump cuts. **Show a still here** shows exactly how a moment will look (framing + colour) before the long render.
   Colour: automatic matching plus brightness, contrast, warmth and colour strength.
   *Framing by hand*: for any section choose wide / close-up, or hold the camera still.
   *Cover parts of the video* (e.g. **0:00 to 1:00** where the picture is unusable): the sound continues and the
   picture is replaced — by other silent moments of the talk, **your own photo or video** (e.g. a photo of
   Babuji Maharaj, with a slow zoom), or a title card — with soft dissolves.
   *Reel captions*: word-by-word highlight (gold / yellow / white) or simple lines.
9. **YouTube package** — ✨ writes 5 title options, a description and tags (chapters are added automatically);
   **Suggest thumbnail pictures** picks the best close-ups; click one, type 2–5 words, download the thumbnail.
10. **Make the final files** — **1080p** on this laptop, then **Make the final files on this computer**. Next to your
   video you get: *Edited - full video.mp4*, the podcast (*.mp3* + *.wav*), captions (*.srt* + *.vtt*),
   *Edited - chapters.txt*, *Edited - YouTube.txt*, every Reel, *Edited - timeline for DaVinci Resolve.fcpxml*
   (open it in DaVinci Resolve: File → Import → Timeline, to fine-tune by hand), *Edited - cut list.edl*,
   *Edited - project.json*, and *Edited - quality check.txt* (lip sync at 3 points, loudness, length,
   black or frozen picture, caption readability).

If anything is interrupted (laptop closed, power cut), start the engine again and press **Resume**
on the job — finished parts are kept.

## 4. The Editor (looks and works like DaVinci Resolve)

At the top of the Studio tab, click **🎬 Open the Editor**. It fills the screen in a dark layout: the
video in the middle, panels on the left and right, the **timeline** at the bottom, and the pages along
the very bottom — **Media · Edit · Color · Fairlight · Deliver**. It is the same project as the steps
above; **Guided view** (top right) takes you back to them. Everything is saved as you go.

| Page | What you do there |
|---|---|
| Media | Choose your video and recorder audio, prepare them, sync them |
| Edit | Transcript on the left, Inspector and Reels/chapters on the right, cut on the timeline |
| Color | Picture panel (framing, colour, covers) with a live preview and a brightness **waveform / RGB parade** scope |
| Fairlight | Sound cleanup, with a large voice waveform (yellow marks = breaths) |
| Deliver | Make the final files, YouTube package, job progress |

Timeline tracks: **V2** covers, **V1** video, **A1** voice (waveform), **ST** subtitles. Blue flags in the
ruler are markers (they become YouTube chapters); pink bars are Reels.

Editing on the timeline:
- **Cut a piece out:** put the playhead at the start, press **Ctrl+B**; at the end, **Ctrl+B** again; click the
  piece in between and press **Delete**. The rest moves up to close the gap (a "ripple delete").
- **Or with In/Out:** press **I** at the start and **O** at the end, then **Delete**.
- **Trim:** drag the left or right edge of a clip. Dragging outwards brings back what was cut there.
- **Words:** select words in the transcript and press **Delete** to cut them.
- **Undo / redo:** **Ctrl+Z** / **Ctrl+Shift+Z** (works for every change, also in the panels).
- Click a clip and use the **Inspector** to set its framing (close-up, wide, hold still), cover it, or make a Reel.

Playing: **Space** play/pause · **J K L** backwards / stop / forwards (press L again for 2× and 4×) ·
**← →** one frame (with Shift: one second) · **↑ ↓** previous/next cut · **M** marker ·
**Ctrl + mouse wheel** zoom · **Shift+Z** fit · **Shift+1…5** change page · **?** all shortcuts.

## Free tools used (all open source)

| Tool | What for | Licence |
|---|---|---|
| ffmpeg (Gyan.dev build on Windows, Homebrew on Mac) | reading/writing video and audio | GPL / LGPL |
| DeepFilterNet 3 (`deep-filter` 0.5.6) | AI voice isolation | MIT / Apache-2.0 |
| uv | installs Python and the engine's libraries | MIT / Apache-2.0 |
| Python 3.13, FastAPI, Uvicorn, NumPy | the engine itself | PSF / MIT / BSD |
| Silero VAD 6 (bundled model) + ONNX Runtime | where the voice is (pauses, breaths, missed ums) | MIT / MIT |
| OpenCV + YuNet face detector (bundled model) | automatic framing (Stage 3) | Apache-2.0 / Apache-2.0 |
