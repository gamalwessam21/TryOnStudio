# Try On Studio

AI-powered virtual clothing try-on, 360° garment rack, gesture-based outfit switching, and camera-based size estimation frontend built with **React**, **TypeScript**, and **Vite**.

---

## Features

- **Live Catalog & 360° Clothing Rack**: Dynamically loads categories, products, color variants, manufactured sizes, and 24-frame 360° rotation sequences from the backend API.
- **Interactive Camera Mirror**: Permission-aware `getUserMedia` webcam preview with mirror-reflection toggle, HTTPS context checks, and automatic media-track cleanup.
- **Decart Realtime Virtual Try-On**: Requests short-lived client tokens (`POST /api/tryon/token` via `apiKeyProvider`, never persisted in storage) and connects via `@decartai/sdk` (`lucy-vton-latest`) with garment reference images and prompts (`enhance: false`). Reports backend configuration errors (such as HTTP `502` when the server Decart key is unset) transparently without faking AI output.
- **MediaPipe Hand-Swipe Navigation**: Uses `@mediapipe/tasks-vision` (`PoseLandmarker`) during active try-on sessions to cycle variants/garments on intentional left/right hand swipes above the hip line with a 1.5s cooldown.
- **Find My Size (Camera Body Scan)**: Guides positioning (1–2m away, full body visible), runs a countdown, captures 20 resized JPEG frames (max 1280px) over 3 seconds from the raw webcam stream, validates image/upload byte limits, and submits multipart `frames` to `POST /api/fashion-items/{id}/size-scan`.
- **Manufactured Size Availability Check**: Integrates `/api/sizes`, `/api/fashion-items/{id}/sizes`, and `POST /api/fashion-items/{id}/size-check`, clearly distinguishing manufactured size offerings from live warehouse stock.

---

## Local Setup & Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `.env` contains:

```env
VITE_API_BASE_URL=https://clothesai3d.runasp.net
```

*(No trailing slash.)*

### 3. Run the development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. Note that the backend currently allows `http://localhost:5173` for local development CORS.

### 4. Available scripts

- `npm run dev` — Start Vite dev server on port `5173`
- `npm run typecheck` — Run TypeScript project references check (`tsc -b --noEmit`)
- `npm run lint` — Run ESLint across `src/`
- `npm test` — Run unit & live API contract tests via Vitest
- `npm run build` — Typecheck and create production bundle in `dist/`
- `npm run preview` — Preview production build locally

---

## Deploying to Vercel

1. Import `https://github.com/gamalwessam21/TryOnStudio` into **Vercel**.
2. Framework Preset: **Vite**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the required **Environment Variable** in Vercel Project Settings → Environment Variables:
   - `VITE_API_BASE_URL` = `https://clothesai3d.runasp.net`
4. `vercel.json` is already included to rewrite client-side SPA routes (`/browse`, `/size-guide`, `/how-it-works`) to `/index.html`.
5. **Important Backend CORS Action Required After Deployment**:
   - Currently, the backend (`https://clothesai3d.runasp.net`) allows `http://localhost:5173`.
   - Production URLs deployed on Vercel:
     - Primary Production Origin: `https://try-on-studio-beta.vercel.app`
     - Secondary Production Alias: `https://try-on-studio-gamal15.vercel.app`
   - Share the exact origin **`https://try-on-studio-beta.vercel.app`** (and optionally `https://try-on-studio-gamal15.vercel.app`, with no trailing slash) with the backend owner so it is added to the backend's allowed CORS origins.
   - HTTPS is automatically provided by Vercel and is required by browsers for `getUserMedia` camera access.

