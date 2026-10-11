"""Render the edit on this computer, then check the result (lip sync at 3 points, loudness, length).

Lip sync stays exact because every cut is snapped to a whole video frame, the picture parts are encoded
without sound, and the sound is assembled once, sample-exact, from the cleaned audio and added at the end.
"""
import json
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path

import numpy as np

from . import audio, config, ff, hardware, media, syncer
from .jobs import Ctx, JobError, file_sig, key_of, mark_done, step_done
from .wavio import Writer, open_pcm16

FADE_S = 0.005


def frames_of(keep: list, fr: Fraction, total_frames: int) -> list[tuple[int, int]]:
    out = []
    for s, e in keep:
        a = max(0, int(round(float(s) * fr)))
        b = min(total_frames, int(round(float(e) * fr)))
        if b - a < 2:
            continue
        if out and a <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


def vcodec(enc: str, kind: str, height: int) -> list[str]:
    full = kind == "full"
    if enc == "h264_videotoolbox":
        rate = "40M" if height > 2000 else "20M" if height > 1500 else "12M"
        return ["-c:v", enc, "-b:v", rate, "-allow_sw", "1"]
    if enc == "h264_nvenc":
        return ["-c:v", enc, "-preset", "p5", "-rc", "vbr", "-cq", "20" if full else "19", "-b:v", "0"]
    if enc == "h264_qsv":
        return ["-c:v", enc, "-preset", "medium", "-global_quality", "22" if full else "21"]
    if enc == "h264_amf":
        return ["-c:v", enc, "-quality", "quality", "-rc", "cqp", "-qp_i", "20", "-qp_p", "22"]
    return ["-c:v", "libx264", "-preset", "veryfast" if full else "medium", "-crf", "20" if full else "19"]


def vfilter(v: dict, kind: str, res: str, reel_h: int, enc: str) -> tuple[str, int]:
    f = []
    w, h = v.get("width") or 1920, v.get("height") or 1080
    if abs(media.rotation(v)) % 180 == 90:
        w, h = h, w
    if kind == "reel":
        rw = reel_h * 9 // 16
        f.append(f"scale={rw}:{reel_h}:force_original_aspect_ratio=increase,crop={rw}:{reel_h}")
        out_h = reel_h
    elif res != "orig":
        n = int(res)
        f.append(media.scale_short_side(n))
        out_h = n if w > h else int(round(h * n / w / 2) * 2)
    else:
        out_h = h
    tm = media.tonemap_chain(v)
    if tm:
        f.append(tm)
    f.append("format=nv12" if enc == "h264_qsv" else "format=yuv420p")
    return ",".join(f), out_h


COLOR = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]


def render_parts(ctx: Ctx, p: dict, video: Path, v: dict, fr: Fraction, segs, d: Path, kind: str, enc: str,
                 res: str, reel_h: int, label: str) -> Path:
    d.mkdir(parents=True, exist_ok=True)
    vf, out_h = vfilter(v, kind, res, reel_h, enc)
    venc = vcodec(enc, kind, out_h)
    gop = str(int(round(float(fr) * 2)))
    total = sum(b - a for a, b in segs)
    done_frames = 0
    names = []
    for i, (a, b) in enumerate(segs):
        part = d / f"part_{i + 1:04d}.mp4"
        names.append(part.name)
        key = key_of({"v": file_sig(video), "a": a, "b": b, "fr": str(fr), "vf": vf, "enc": venc, "ver": 1})
        if not step_done(part, key):
            tmp = ff.tmp_of(part)
            start = float(Fraction(a) / fr)
            base = done_frames
            ctx.progress(base / total, f"{label}: part {i + 1} of {len(segs)}…")
            media.run_video(ctx, p, ["-ss", f"{start:.6f}", "-i", video, "-map", "0:v:0", "-an", "-vf", vf,
                                     "-fps_mode", "cfr", "-r", str(fr), "-frames:v", b - a] + venc +
                            ["-g", gop] + COLOR + [tmp],
                            duration=None)
            ff.finish(tmp, part)
            mark_done(part, key)
        done_frames += b - a
        ctx.progress(done_frames / total, f"{label}: part {i + 1} of {len(segs)} done")
    lst = d / "list.txt"
    lst.write_text("".join(f"file '{n}'\n" for n in names), encoding="utf-8")
    return lst


def assemble_audio(clean: Path, segs, fr: Fraction, out: Path, xfade_ms: float = 40.0):
    """Cut the cleaned sound exactly like the picture. At every cut the two sides cross-fade (equal power,
    centred on the cut, using the sound just past each edge), so joins are smooth and click-free while the
    total length - and lip sync - stay exact."""
    arr, rate, ch = open_pcm16(clean)
    total_src = arr.shape[0]
    tmp = ff.tmp_of(out)
    w = Writer(tmp, rate, ch)

    def src(a: int, b: int) -> np.ndarray:  # source samples a..b, silence outside the file
        x = np.zeros((b - a, ch), np.float32)
        lo, hi = max(0, a), min(total_src, b)
        if hi > lo:
            x[lo - a:hi - a] = np.asarray(arr[lo:hi], dtype=np.float32) / 32768.0
        return x

    # sample positions of every part: start in the source, length in the output (exact, frame based)
    parts, cum = [], 0
    for a, b in segs:
        o0 = int(round(Fraction(cum) / fr * rate))
        cum += b - a
        parts.append((int(round(Fraction(a) / fr * rate)), int(round(Fraction(cum) / fr * rate)) - o0))
    want = int(round(float(xfade_ms) / 2000 * rate)) if xfade_ms and xfade_ms > 0 else 0
    halves = [min(want, parts[k][1] // 3, parts[k + 1][1] // 3) for k in range(len(parts) - 1)]
    for k, (s0, n) in enumerate(parts):
        left = halves[k - 1] if k > 0 else 0
        right = halves[k] if k < len(parts) - 1 else 0
        body = src(s0 + left, s0 + n - right)
        if want == 0 and len(parts) > 1 and n > 2 * int(FADE_S * rate):  # no cross-fade: tiny fades, no clicks
            f = int(FADE_S * rate)
            ramp = np.linspace(0.0, 1.0, f, dtype=np.float32)[:, None]
            if k > 0:
                body[:f] *= ramp
            if k < len(parts) - 1:
                body[-f:] *= ramp[::-1]
        w.write(body)
        if right:
            h = right
            ns0 = parts[k + 1][0]
            ang = np.linspace(0.0, np.pi / 2, 2 * h, dtype=np.float32)[:, None]
            w.write(src(s0 + n - h, s0 + n + h) * np.cos(ang) + src(ns0 - h, ns0 + h) * np.sin(ang))
    w.close()
    ff.finish(tmp, out)


def concat_mux(ctx: Ctx, lst: Path, wav: Path, out: Path, dur: float, msg: str, burn_ass: Path | None = None,
               enc: str = "libx264", out_h: int = 1920):
    tmp = ff.tmp_of(out).resolve()
    args = ["-f", "concat", "-safe", "0", "-i", lst.resolve(), "-i", wav.resolve(), "-map", "0:v:0", "-map", "1:a:0"]
    if burn_ass:
        args += ["-vf", f"subtitles={burn_ass.name}," + ("format=nv12" if enc == "h264_qsv" else "format=yuv420p")]
        args += vcodec(enc, "reel", out_h) + COLOR
    else:
        args += ["-c:v", "copy"]
    args += ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", tmp]
    # libass wants a plain file name, so ffmpeg runs inside the reel folder (inputs use full paths)
    ff.run_ff(ctx, args, duration=dur, msg=msg, cwd=burn_ass.parent if burn_ass else None)
    ff.finish(tmp, out)


def _pcm16k(path, start: float, dur: float) -> np.ndarray:
    cmd = [ff.tool("ffmpeg"), "-v", "error", "-ss", f"{max(0.0, start):.4f}", "-i", str(path), "-t", f"{dur:.4f}",
           "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"]
    r = subprocess.run(cmd, capture_output=True, creationflags=0x08000000 if config.IS_WIN else 0)
    return np.frombuffer(r.stdout, "<i2").astype(np.float32) / 32768.0


def lipsync_qc(final: Path, cam16: Path, segs, fr: Fraction) -> list[dict]:
    """At 10% / 50% / 90% of the finished video, compare its sound with the camera's own sound at the same
    picture frame. A perfect render shows 0 ms (plus whatever sync error the recording itself had)."""
    starts, cum = [], 0
    for a, b in segs:
        starts.append(cum)
        cum += b - a
    total = cum / fr
    W, S = 8.0, 0.5
    out = []
    for f in (0.1, 0.5, 0.9):
        want = float(total) * f
        best = None
        for (a, b), o in zip(segs, starts):
            o_s, len_s = float(Fraction(o) / fr), float(Fraction(b - a) / fr)
            if len_s < W + 1:
                continue
            t = min(max(want, o_s + 0.5), o_s + len_s - W - 0.5)
            dist = abs(t - want)
            if best is None or dist < best[0]:
                best = (dist, t, float(Fraction(a) / fr) + (t - o_s))
        if not best:
            out.append({"at": round(want, 1), "ok": None, "note": "no part long enough to measure"})
            continue
        _, t_out, t_src = best
        y = _pcm16k(final, t_out, W)
        x, rate, s0 = syncer.read_window(cam16, t_src - S, W + 2 * S)
        if len(y) < rate * 2 or len(x) < len(y):
            out.append({"at": round(t_out, 1), "ok": None, "note": "could not read the sound"})
            continue
        lag, conf = syncer.xcorr(y, x, 0, len(x) - len(y), phat=0.8)
        # camera sound at t_src lines up with rendered sound at t_out; offset > 0 means sound is late
        off_ms = ((t_src - s0) - lag / rate) * 1000
        good = conf >= 4
        out.append({"at": round(t_out, 1), "offset_ms": round(off_ms, 1), "confidence": round(conf, 1),
                    "ok": (abs(off_ms) < 20) if good else None,
                    "note": "" if good else "too little matching sound here to measure reliably"})
    return out


def measure_loudness(ctx: Ctx, path: Path, dur: float) -> dict:
    text = ff.run_ff(ctx, ["-i", path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
                     duration=dur, msg="Checking loudness…", loglevel="info", want_stderr=True)
    import re
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", text)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", text)
    return {"lufs": float(i[-1]) if i else None, "true_peak": float(tp[-1]) if tp else None}


def fmt(t: float) -> str:
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def job_render(ctx: Ctx, p: dict) -> dict:
    video = media._need(p.get("video"), "video")
    vinfo = ff.probe(video)
    v = media.stream(vinfo, "video")
    if not v:
        raise JobError("That file has no picture.")
    vdur = media.duration(vinfo)
    fr = Fraction(media.output_fps(v))
    total_frames = int(vdur * fr)
    keep = p.get("keep") or [[0, vdur]]
    segs = frames_of(keep, fr, total_frames)
    if not segs:
        raise JobError("Nothing left to render — everything is cut.")
    st = p.get("settings") or {}
    hw = hardware.report()
    enc = st.get("enc") or "auto"
    enc = hw["best_encoder"] if enc == "auto" else enc
    res = str(st.get("res") or "1080")
    reel_h = 1280 if str(st.get("reelRes")) == "720" else 1920
    out_dir = video.parent
    wd = media.work_dir(str(video)) / "render"
    wd.mkdir(exist_ok=True)
    edited_s = float(Fraction(sum(b - a for a, b in segs)) / fr)
    reels = p.get("reels") or []
    reel_s = sum(float(r.get("end", 0)) - float(r.get("start", 0)) for r in reels)
    gb_per_h = {"orig": 25, "1440": 10, "1080": 5}.get(res, 5)
    hardware.disk_check(out_dir, 1 + (edited_s * 2 * gb_per_h + reel_s * 12) / 3600 + edited_s / 3600 * 1.5,
                        "the finished video")
    w_full = 0.8 if reels else 0.95
    # 1. sound
    ctx.stage(0.0, 0.12)
    cl = audio.ensure_clean(ctx, p)
    clean = Path(cl["clean_audio"])
    # 2. picture parts
    ctx.stage(0.12, 0.12 + w_full * 0.8)
    lst = render_parts(ctx, p, video, v, fr, segs, wd / "full", "full", enc, res, reel_h, "Full video")
    ctx.stage(0.12 + w_full * 0.8, 0.12 + w_full * 0.85)
    ctx.progress(0, "Putting the sound together…")
    full_wav = wd / "edited_audio.wav"
    xf = float(st.get("xfade_ms", 40) or 0)
    assemble_audio(clean, segs, fr, full_wav, xf)
    final = out_dir / "Edited - full video.mp4"
    concat_mux(ctx, lst, full_wav, final, edited_s, "Joining the full video…")
    ctx.progress(0.6, "Making the podcast files…")
    shutil.copyfile(full_wav, out_dir / "Edited - full audio.wav")
    ff.run_ff(ctx, ["-i", full_wav, "-c:a", "libmp3lame", "-b:a", "192k", out_dir / "Edited - full audio.mp3"],
              duration=edited_s, msg="Making the podcast MP3…")
    if p.get("srt"):
        (out_dir / "Edited - full video.srt").write_text(p["srt"], encoding="utf-8")
    if p.get("chapters"):
        (out_dir / "Edited - chapters.txt").write_text(p["chapters"] + "\n", encoding="utf-8")
    outputs = [str(final), str(out_dir / "Edited - full audio.mp3"), str(out_dir / "Edited - full audio.wav")]
    # 3. reels
    lo = 0.12 + w_full * 0.9
    for ri, r in enumerate(reels):
        ctx.stage(lo + (0.95 - lo) * ri / len(reels), lo + (0.95 - lo) * (ri + 1) / len(reels))
        rsegs = frames_of(r.get("segs") or [[r["start"], r["end"]]], fr, total_frames)
        if not rsegs:
            continue
        rd = wd / f"reel_{ri + 1}"
        rl = render_parts(ctx, p, video, v, fr, rsegs, rd, "reel", enc, res, reel_h, f"Reel {ri + 1}")
        rwav = rd / "audio.wav"
        assemble_audio(clean, rsegs, fr, rwav, xf)
        name = "".join(c for c in str(r.get("name") or f"Reel {ri + 1:02d}") if c not in '\\/:*?"<>|').strip()[:80]
        rout = out_dir / f"{name}.mp4"
        ass = None
        if r.get("ass") and st.get("reelCaps", True):
            ass = rd / "captions.ass"
            ass.write_text(r["ass"], encoding="utf-8")
        concat_mux(ctx, rl, rwav, rout, float(Fraction(sum(b - a for a, b in rsegs)) / fr),
                   f"Reel {ri + 1}: finishing…", burn_ass=ass, enc=enc, out_h=reel_h)
        outputs.append(str(rout))
    # 4. quality check
    ctx.stage(0.95, 1.0)
    ctx.progress(0, "Quality check: lip sync at 3 points…")
    qc = {"lipsync": [], "expected_s": round(edited_s, 3)}
    cam16 = media.work_dir(str(video)) / "video_16k.wav"
    if cam16.exists():
        qc["lipsync"] = lipsync_qc(final, cam16, segs, fr)
    got = media.duration(ff.probe(final))
    qc["duration_s"] = round(got, 3)
    qc["duration_ok"] = abs(got - edited_s) < 0.1
    qc["loudness"] = measure_loudness(ctx, final, edited_s)
    s = audio.settings(p)
    lu = qc["loudness"].get("lufs")
    qc["loudness_ok"] = lu is not None and abs(lu - s["lufs"]) <= 1.0 and (qc["loudness"].get("true_peak") or 0) <= -1.0
    lines = [f"Quality check — {final.name}", ""]
    for l in qc["lipsync"]:
        if l.get("ok") is None:
            lines.append(f"?  Lip sync at {fmt(l['at'])}: not measured ({l.get('note')})")
        else:
            lines.append(f"{'✓' if l['ok'] else '⚠'}  Lip sync at {fmt(l['at'])}: {l['offset_ms']:+.1f} ms "
                         f"({'sound late' if l['offset_ms'] > 0 else 'sound early'}; must be under 20 ms)")
    if not qc["lipsync"]:
        lines.append("?  Lip sync: not measured (run Prepare first so the camera sound is available)")
    lines.append(f"{'✓' if qc['loudness_ok'] else '⚠'}  Loudness {lu if lu is not None else '?'} LUFS "
                 f"(target {s['lufs']}), true peak {qc['loudness'].get('true_peak')} dB (limit −1.5)")
    lines.append(f"{'✓' if qc['duration_ok'] else '⚠'}  Length {fmt(got)} (expected {fmt(edited_s)})")
    lines.append(f"   Video encoder: {hardware.report()['best_encoder_name'] if (st.get('enc') or 'auto') == 'auto' else enc}")
    qc["text"] = "\n".join(lines)
    (out_dir / "Edited - quality check.txt").write_text(qc["text"] + "\n", encoding="utf-8")
    qc_ok = all(l.get("ok") is not False for l in qc["lipsync"]) and qc["duration_ok"] and qc["loudness_ok"]
    return {"outputs": outputs, "qc": qc, "folder": str(out_dir), "encoder": enc, "clean": cl,
            "message": ("Finished ✓ — quality check passed." if qc_ok else "Finished — the quality check found something to look at (see below).")}
