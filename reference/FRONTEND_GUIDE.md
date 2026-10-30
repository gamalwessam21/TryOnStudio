# Frontend Guide: Try On Studio mirror

This guide explains how to build in the frontend **the same thing the demo does**: camera, Decart try-on, changing the garment with a hand swipe, and the size result. It lists every endpoint you need, what it does, and example code for each part.

> The demo (`demo/`) is a local Python app for one laptop. It is **not** what gets deployed. Use it as a **behaviour reference**: run it (`python -m demo.app`), watch each step, then rebuild it in the frontend with the endpoints below.

## 1. Big picture

```
Browser (any laptop + webcam)
  ├─ talks to the .NET backend only:   catalog, Decart token, size scan
  ├─ talks to Decart directly (WebRTC) with a short-lived token from the backend
  └─ runs MediaPipe in JavaScript in the browser (for the swipe gesture only)

.NET backend ──(frames + size chart)──► AI service (Python, on a VPS) ──► size
```

- **The frontend never calls the AI service.** The backend does, so the API key stays secret. The only size endpoint the frontend knows is `POST /api/fashion-items/{id}/size-scan`.
- Browser cameras only work over **HTTPS**.

## 2. What the demo does, and the frontend equivalent

| # | In the demo | In the frontend |
|---|---|---|
| 1 | One button turns the camera on/off | `navigator.mediaDevices.getUserMedia` ... `track.stop()` (section 5) |
| 2 | Picking a garment card only selects it; Decart does not start | Catalog endpoints (section 3). The chosen colour is the variant |
| 3 | **Start try-on** opens Decart (2-5 s) | `POST /api/tryon/token`, then the Decart SDK with the variant's `tryOnPrompt` and image |
| 4 | While Decart is on: **swipe a hand** right/left to change the garment | MediaPipe JS + `SwipeDetector` (section 6) |
| 5 | **Choose this outfit** keeps the garment and closes Decart | `disconnect` Decart, keep the chosen item/variant, enable the size button |
| 6 | **Get my size**: 8 s countdown, ~3 s capture, size shown | Capture frames (section 4), then `POST .../size-scan` (section 3) |

Important order: **the size is measured with the normal camera on and Decart OFF** (not while the user is wearing the garment in Decart). The size button stays disabled until the user picks a top and presses Choose.

## 3. Endpoints the frontend uses (backend)

Base URL: `VITE_API_BASE_URL`. All responses are JSON; IDs are numbers (RackItem.id is a string). Error shape is always `{ "error": "...", "errors": null }`.

**Catalog (already exists):**

| Method | Path | Response |
|---|---|---|
| GET | `/api/categories` | `[{id, name, slug, itemCount}]` |
| GET | `/api/fashion-items?categoryId=&search=` | list of items |
| GET | `/api/fashion-items/{id}` | `{id, name, description, price, variants[], availableSizes[], ...}` |
| GET | `/api/fashion-items/{id}/variants` | `[{id, colorName, colorHex, imageUrl, tryOnPrompt}]` |
| GET | `/api/fashion-items/rack?take=6` | rack items with rotation images |
| GET | `/api/sizes` | all sizes `["XS","S",...,"XXXL"]` |
| GET | `/api/fashion-items/{id}/sizes` | sizes available for the item |
| POST | `/api/fashion-items/{id}/size-check` | `{size}` -> is it available + nearest alternatives |

**Decart (already exists):** `POST /api/tryon/token` -> `{apiKey, expiresAt}`. The token is short-lived (~2 minutes): request a new one before every connection and do not store it. A 502 means the Decart key is not set on the server.

**Size (implemented by the backend, per `INTEGRATION.md`):**

`POST /api/fashion-items/{id}/size-scan`, `multipart/form-data`, repeated field `frames` (8 to 40 JPEG/PNG images, ideally 15-30). Do not set `Content-Type` yourself; the browser adds it with the boundary.

Success (200):
```json
{ "size": "M", "alternative": "L", "borderline": true, "sizeRange": "M-L", "confidence": "high" }
```
- Show `size`. If `borderline` is true the user is between two sizes: show `sizeRange` (e.g. `M-L`).
- The returned size is **always one of the sizes available for the item**, so no `size-check` call is needed afterwards.
- If the item has only one size, it is returned without a scan.

Errors:

| Status | Meaning | What to do |
|---|---|---|
| 422 | The scan is not usable: body not visible, too close, turned, or height could not be computed. The body has `error` (user-facing message) and `code` (`no_pose` / `too_close` / `turned` / `bad_height`) | **Show `error` as is** and let the user retry |
| 409 | The item has no sizes (Decart-only items) | Show "Sizes are not available" |
| 400 | Missing or invalid images | Probably a bug on your side, log it |
| 429 | Too many requests (10 per minute per IP) | Wait and retry later |
| 502 | AI service unavailable | Generic message and retry |

The first request after a quiet period can take a few seconds (the service wakes up), so use a **60 s timeout**.

## 4. Capturing and sending frames (JavaScript)
```js
// 1) Open the camera (HTTPS only)
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
});
video.srcObject = stream;
await video.play();
// To close the camera:  stream.getTracks().forEach(t => t.stop());

// 2) Capture about 20 frames over 3 seconds (from the real video, not a mirrored copy)
async function captureFrames(video, { count = 20, durationMs = 3000, quality = 0.85 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  const frames = [];
  for (let i = 0; i < count; i++) {
    ctx.drawImage(video, 0, 0);
    frames.push(await new Promise(r => canvas.toBlob(r, "image/jpeg", quality)));
    await new Promise(r => setTimeout(r, durationMs / count));
  }
  return frames;
}

// 3) Send them to the backend
async function requestSize(itemId, frames) {
  const form = new FormData();
  frames.forEach((blob, i) => form.append("frames", blob, `frame${i}.jpg`));   // field name must be "frames"
  const res = await fetch(`${BASE_URL}/api/fashion-items/${itemId}/size-scan`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };      // {error, code} for 422
  return data;                                              // {size, alternative, borderline, sizeRange, confidence}
}
```

**Required UX:**
1. The user picks a top and presses Choose (Decart closes, the normal camera shows).
2. Tell them: "Step back about 1 to 2 metres, keep your whole body visible from head to feet, face the camera with a small gap between your arms and body, and stand still."
3. "Get my size" button -> **8 second countdown** (time to step back and settle) -> 3 s capture -> loading indicator -> result.
4. On a 422, show the error message and let the user try again.

## 5. Camera on/off
The demo has one "Turn camera on/off" button. The camera starts **off**. Turning it off also closes Decart. The size button must not work while the camera is off.

## 6. Changing the garment with a hand swipe
This works **only while Decart is on**. Swiping toward the **right of the screen = next garment**, **left = previous**, with either hand. It cycles through garments of the **same type** (t-shirts, or pants, or hats) and wraps around at the end. All the logic is in `demo/gesture.py` (same numbers below).

Rules for a swipe (so it does not fire by accident):
- The wrist must be **above the hip line** (a hand hanging down is ignored).
- Horizontal travel of about **0.9 shoulder widths** within **0.7 seconds**.
- Horizontal movement at least **2x** the vertical movement (raising an arm is not a swipe).
- After each swipe, **1.5 seconds** of cooldown.

Body detection in the browser uses MediaPipe (`@mediapipe/tasks-vision`):
```js
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");   // pin a specific version instead of latest
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
  },
  runningMode: "VIDEO",
  numPoses: 1,
});

const swipe = new SwipeDetector();
function loop() {
  if (decartConnected) {
    const result = poseLandmarker.detectForVideo(video, performance.now());
    const direction = swipe.update(result.landmarks?.[0], video.videoWidth, video.videoHeight, performance.now());
    if (direction) changeGarment(direction);          // "next" | "prev"
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

The class (same logic as `demo/gesture.py`):
```js
const L_SH = 11, R_SH = 12, L_WRIST = 15, R_WRIST = 16, L_HIP = 23, R_HIP = 24;
const WINDOW_MS = 700, MIN_SWEEP = 0.9, H_RATIO = 2.0, COOLDOWN_MS = 1500, MIN_VIS = 0.5, MIN_SAMPLES = 4;

class SwipeDetector {
  constructor() { this.hist = { [L_WRIST]: [], [R_WRIST]: [] }; this.blockedUntil = 0; }
  reset() { this.hist[L_WRIST].length = 0; this.hist[R_WRIST].length = 0; }

  // lm: landmarks (x,y in 0..1) from the NON-mirrored video. w,h: video size in pixels. now: ms
  update(lm, w, h, now) {
    if (!lm || lm.length <= R_HIP) { this.reset(); return null; }
    if (now < this.blockedUntil) return null;
    // Mirror view: screen right = user's right, so flip x. Multiply by w and h so the horizontal/vertical ratio is right.
    const px = p => ({ x: (1 - p.x) * w, y: p.y * h, v: p.visibility ?? 1 });
    const ls = px(lm[L_SH]), rs = px(lm[R_SH]);
    const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (shoulderW <= 0) { this.reset(); return null; }
    const hipY = ((lm[L_HIP].y + lm[R_HIP].y) / 2) * h;

    for (const idx of [L_WRIST, R_WRIST]) {
      const hist = this.hist[idx];
      const p = px(lm[idx]);
      if (p.v < MIN_VIS || p.y > hipY) { hist.length = 0; continue; }   // hidden, or hand is low
      hist.push({ t: now, x: p.x, y: p.y });
      while (hist.length && now - hist[0].t > WINDOW_MS) hist.shift();
      if (hist.length < MIN_SAMPLES) continue;
      const dx = hist[hist.length - 1].x - hist[0].x;
      const dy = hist[hist.length - 1].y - hist[0].y;
      if (Math.abs(dx) >= MIN_SWEEP * shoulderW && Math.abs(dx) >= H_RATIO * Math.abs(dy)) {
        this.blockedUntil = now + COOLDOWN_MS;
        this.reset();
        return dx > 0 ? "next" : "prev";
      }
    }
    return null;
  }
}
```

`changeGarment(direction)`: take the list of colours/items of the **same type**, move to the next or previous one **with wrap-around** (`(i + 1) % n`, `(i - 1 + n) % n`), and switch in Decart with the existing `setImage` call (image + `tryOnPrompt`). A switch takes 1 to 3 seconds, so show "Changing garment..." and do not start another switch until the previous one finishes.

**Tune the numbers by testing:** if swiping is too hard, lower `MIN_SWEEP`. If it fires by itself, raise it or raise `COOLDOWN_MS`. (This code was written as a reference and has not been tested in a browser, so test it.)

## 7. Decart notes (what you will notice)
- Opening a session takes **2 to 5 seconds** on Decart's side. Show "Connecting...".
- Every update to Decart sends the **prompt, image and enhance together** (`set()` replaces the whole state).
- Best prompt pattern: `Substitute the current top with <precise garment description>.` For pants: `Substitute the current pants with ...`. For a hat: `Add ... to the person's head.` Set `enhance` to `false`. (Our backend returns a ready `tryOnPrompt` for every colour.)
- Image: one garment on a plain background, at least 512 px.
- Decart bills per second from the moment of connection, so call `disconnect` as soon as the user presses Choose or leaves the page.

## 8. The AI service (reference only; the frontend does not call it)
It runs on a VPS and only the backend calls it, with `X-API-Key`. A Swagger page is at `<service url>/docs` for trying it.

| Endpoint | What it does |
|---|---|
| `GET /health` | Check that it is running |
| `POST /size` | Frames + the garment's size chart -> size. Height and shoulder come from the camera; the user enters nothing |
| `POST /garments/prepare` | Garment image + type + description -> prompt and a clean image for Decart (optional) |
| `POST /outfit/prepare` | Several garments (top + pants + hat) -> one prompt and one stacked image |
| `POST /calibrate` | Fixed-camera height calibration (not used now) |

Full details are in `INTEGRATION.md` and `README.md`.

## 9. Known limits
- Height is measured by MediaPipe from the camera and reads about 6% low, so the size can come out one size smaller or larger. The final fix is a depth camera later; the API will not change.
- The size chart is currently a generic default for all items (until real measurements are recorded per item).
- Size is for tops only. Hats and pants have no size.
- Tested on one person and one laptop camera.

## 10. The demo as a reference (local endpoints, not for production)
To see the behaviour in detail, read `demo/app.py`, `demo/static/index.html` and `demo/gesture.py`. Its local endpoints:

| Endpoint | What it does |
|---|---|
| `POST /api/camera/on` and `/off` | Turn the camera on/off |
| `GET /api/garments` | List garments |
| `POST /api/tryon` `{garment_ids}` | Select a garment (swapped live if Decart is on) |
| `POST /api/tryon/start` / `/stop` | Open / close Decart |
| `POST /api/tryon/confirm` | Choose this outfit |
| `POST /api/size?delay_s=8` | Get the size |
| `GET /api/status` | State (camera, Decart, garment, last type) |
