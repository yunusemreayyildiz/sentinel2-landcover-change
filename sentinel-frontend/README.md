# Sentinel-2 Change Detection — Frontend

Next.js (App Router) client for the Sentinel-2 land cover change detection
project. Full project overview, architecture, and setup instructions live in
the [repository root README](../README.md) — this file covers only what's
specific to the frontend.

## What's here

- **Map view** — draw a bounding box (`leaflet-draw`), pick a before/after
  date pair, and kick off an analysis job against the backend.
- **Progress screen** — polls job status while the backend runs scene search,
  download, indexing, and CNN validation.
- **Comparison view** — a single-map swipe/curtain overlay showing the real
  before/after Sentinel-2 imagery plus color-coded change polygons
  (confirmed / rejected / unverifiable).
- **Report view** — renders the Claude-generated written report and offers a
  GeoJSON download of the detected polygons.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app talks to the
backend at `NEXT_PUBLIC_API_BASE_URL` (see `.env.local`; defaults to
`http://127.0.0.1:8000`), so start `sentinel-backend` first — see the root
README for backend setup.

Set `NEXT_PUBLIC_MOCK_ANALIZ=true` to run the frontend against a simulated
analysis job (staged progress + real static `/analiz` data) without needing
the backend's full geo/ML pipeline running.

## Stack

Next.js, React, TypeScript, Tailwind CSS, React-Leaflet + `leaflet-draw`.

> Note: this project pins a Next.js version that may differ from what an LLM
> or older tutorial expects — check `node_modules/next/dist/docs/` before
> relying on API assumptions from memory.
