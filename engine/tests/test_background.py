"""Person cut-out (RVM) and background replacement, and the owner's own framing box.
Uses the face test video from test_stage3 (needs STUDIO_TEST_FACE). The model is downloaded once
(or set STUDIO_RVM_MODEL=/path/rvm_mobilenetv3_fp32.onnx)."""
import subprocess
from pathlib import Path

import numpy as np

from .conftest import probe, run
from .test_stage3 import DUR, H, W, face_media, pytestmark  # noqa: F401  (same test video, same skip rule)


def still(path):
    info = probe(path)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt",
                          "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(float)


def test_matte_finds_the_person(eng, face_media):
    r = run(eng, "matte", {"video": face_media["video"]})
    m = Path(r["matte"])
    info = probe(m)
    v = info["streams"][0]
    assert v["pix_fmt"] in ("gray", "yuv420p") and abs(float(info["format"]["duration"]) - DUR) < 0.2
    # the face square (x 210-510, y 250-550 before 18 s) is "person", the empty sides are not
    mw, mh = int(v["width"]), int(v["height"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "5", "-i", str(m), "-frames:v", "1", "-f", "rawvideo",
                          "-pix_fmt", "gray", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(mh, mw).astype(float)
    sx, sy = mw / W, mh / H
    face = a[int(330 * sy):int(470 * sy), int(290 * sx):int(430 * sx)].mean()
    side = np.concatenate([a[:, : int(150 * sx)].ravel(), a[int(1000 * sy):, :].ravel()]).mean()
    assert face > 150 and side < 40, (face, side)
    assert run(eng, "matte", {"video": face_media["video"]})["matte"] == r["matte"]  # done once


def test_background_colour_and_own_framing(eng, face_media):
    run(eng, "matte", {"video": face_media["video"]})
    st = {"res": "1080", "layout": "original", "background": {"mode": "colour", "colour": "#c81e1e"}}
    f = still(run(eng, "frame", {"video": face_media["video"], "t": 5, "settings": st})["frame"])
    h, w = f.shape[:2]
    corner = f[int(h * 0.9):, : int(w * 0.15)].reshape(-1, 3).mean(axis=0)
    assert corner[0] > 170 and corner[1] < 60 and corner[2] < 60, corner  # background is now red
    fy0, fy1 = int(330 / H * h), int(470 / H * h)
    face = f[fy0:fy1, int(290 / W * w):int(430 / W * w)].reshape(-1, 3).mean(axis=0)
    assert not (face[0] > 170 and face[1] < 60), face  # the person is still there
    # own framing: only the top half, i.e. "remove the lower part" (same shape as the video, zoomed in)
    st2 = {"res": "1080", "layout": "original", "rect": {"x": 0.25, "y": 0.1, "w": 0.5}}
    g = still(run(eng, "frame", {"video": face_media["video"], "t": 5, "settings": st2})["frame"])
    assert g.shape == f.shape
    # the face (x 210-510 of 720, y 250-550 of 1280) fills much more of the picture when zoomed in on it
    from studio_engine.faces import detector
    import cv2
    img = cv2.cvtColor(g.astype(np.uint8), cv2.COLOR_RGB2BGR)
    _, found = detector(img.shape[1], img.shape[0]).detect(img)
    assert found is not None and len(found) and max(r[3] for r in found) / img.shape[0] > 0.18
