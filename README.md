<h1 align="center">Sentinel-2 Land Cover Change Detection</h1>

<p align="center">
  Bi-temporal built-up (urban expansion) detection from Sentinel-2 imagery —
  a spectral-index candidate generator, a CNN validator, and an LLM report writer,
  wired end-to-end behind a map-driven web app.
</p>

<p align="center">
  <img src="sentinel-backend/data/v1_vs_v2.png" alt="v1 candidate polygons vs. v2 CNN-validated result" width="700">
</p>

## What it does

A user draws a bounding box on a map and picks two dates. The system finds the
matching Sentinel-2 scenes, computes the spectral change between them, extracts
candidate change polygons, filters them through a CNN, and returns:

- a **before/after image comparison** (swipe view) over the selected area,
- **color-coded change polygons** (confirmed / rejected / unverifiable),
- a **natural-language report** summarizing the findings.

The detector works at **site/neighborhood scale (10 m resolution)** — it does
not claim to identify individual buildings. Polygons that fall on the edge of
a scene and can't be validated are reported as *unverifiable* rather than
silently dropped or guessed at.

## Why three layers instead of one model

| Layer | What it does | Why |
|---|---|---|
| **v1 — spectral indices** | Thresholds `dNDVI` / `dNDBI` (vegetation-loss + built-up-gain) per pixel, masks clouds/water via Sentinel-2's `SCL` band, vectorizes into polygons | Fully deterministic and explainable — every flagged polygon traces back to a formula, not a black box |
| **v2 — CNN validation** | Classifies a 64×64 RGB patch per candidate with an EfficientNet-B0 (EuroSAT-pretrained) and keeps only `Industrial` / `Residential` / `Highway` predictions above a confidence threshold | Acts purely as a **filter**, never proposes new candidates — false positives from v1 (e.g. seasonal vegetation noise) get screened out |
| **v3 — LLM report** | Sends the numeric summary (not the imagery) to Claude, which writes a structured institutional-style report | Turns a JSON blob of counts/areas into something a decision-maker can actually read |

## Architecture

```
┌─────────────┐   draw bbox + dates    ┌──────────────┐
│  Next.js UI │ ─────────────────────▶ │  FastAPI      │
│ (Leaflet)   │  POST /analiz          │  backend      │
└─────────────┘ ◀───────────────────── └──────┬───────┘
      │           { isNo }  (job queued,             │
      │            runs in BackgroundTasks)           │
      │  poll GET /analiz/{isNo}/durum                │
      ▼                                                ▼
┌─────────────┐                          ┌─────────────────────────┐
│ progress +   │                         │ 1. scene_selection.py    │
│ swipe view + │                         │    (STAC search, cloud   │
│ report panel │                         │    filter, ±15-20d window)│
└─────────────┘                          │ 2. stac_fetch.py          │
                                          │    (stream 6 bands, COG)  │
                                          │ 3. preprocess.py          │
                                          │    (reproject, SCL mask)  │
                                          │ 4. v1_candidates.py       │
                                          │    (dNDVI/dNDBI → polygons)│
                                          │ 5. v2_validate.py         │
                                          │    (EfficientNet-B0 CNN)  │
                                          │ 6. rgb_export.py          │
                                          │    (before/after PNGs)    │
                                          └─────────────────────────┘
```

Analysis runs as a background job (`POST /analiz` → job id → poll
`GET /analiz/{id}/durum`) instead of a blocking request, since a full run
(scene search + download + CNN inference) takes roughly 1–2 minutes.

## Tech stack

**Backend** — Python, FastAPI, `BackgroundTasks` for async jobs

**Earth observation** — [STAC](https://stacspec.org/) via
[Element84 Earth Search](https://element84.com/earth-search/) (Sentinel-2 L2A,
Cloud-Optimized GeoTIFFs), `odc-stac` / `rioxarray` for windowed band
streaming, `pyproj` for geodesic area checks, `scipy` + `rasterio` for
raster → polygon vectorization

**ML** — `timm` EfficientNet-B0 pretrained on EuroSAT, `torch` for inference,
with a linear domain-shift correction (Sentinel-2 reflectance patches are
re-scaled to match EuroSAT's training distribution before classification)

**LLM** — Anthropic Claude API, turns the analysis summary into a written report

**Frontend** — Next.js (App Router), React-Leaflet + `leaflet-draw` for the
bbox drawing tool, a custom swipe/curtain comparison view for before/after
imagery

## Project structure

```
sentinel-backend/
├── main.py              FastAPI app — /analiz, /rapor, job status, image/geojson export
├── src/
│   ├── stac_fetch.py     STAC search + bbox validation + band streaming
│   ├── scene_selection.py  cloud/date-window scene picking
│   ├── preprocess.py     reprojection + SCL cloud/water masking
│   ├── v1_candidates.py  index thresholding → candidate polygons
│   ├── v2_validate.py    patch extraction + CNN classification
│   ├── rgb_export.py     before/after PNG preview export
│   └── pipeline.py       orchestrates the above
├── models/best_effnetb0_rgb.pt   EfficientNet-B0 checkpoint (EuroSAT, 10 classes)
├── data/                 static demo reference (Arnavutköy, İstanbul)
└── tests/                parity tests against the original notebook + edge cases

sentinel-frontend/
├── src/app/              pages (map view, comparison, report)
├── src/components/       map, bbox drawing, progress screen, report generator
└── src/lib/api.ts        typed client for the backend API
```

## Getting started

### Backend

```bash
cd sentinel-backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cp .env.example .env           # then set ANTHROPIC_API_KEY inside

uvicorn main:app --reload
```

The API comes up at `http://127.0.0.1:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd sentinel-frontend
npm install
npm run dev
```

The app comes up at `http://localhost:3000` and expects the backend at
`NEXT_PUBLIC_API_BASE_URL` (see `.env.local`, defaults to
`http://127.0.0.1:8000`).

## API overview

| Endpoint | Purpose |
|---|---|
| `GET /analiz` | Static demo summary (no params) or a **synchronous** dynamic run (`bbox`, `tarih_once`, `tarih_sonra`) |
| `POST /analiz` | Starts a dynamic run **asynchronously**, returns a job id |
| `GET /analiz/{id}/durum` | Poll job status / progress / result |
| `GET /analiz/{id}/once.png` / `.../sonra.png` | Before/after true-color preview images |
| `GET /analiz/{id}/geojson` | Downloadable change polygons for a completed job |
| `GET /rapor?is_no=` | Claude-generated natural-language report for a job (or the static demo if omitted) |

## Scope & honesty by design

- Resolution is 10 m — this is a **site/neighborhood-scale** tool, not a
  building-level one.
- Both dates are constrained to the same season (June–September) because the
  detection thresholds were calibrated on same-season imagery; comparing
  across seasons would confuse vegetation cycles with real change.
- Candidates that can't be validated (e.g. they fall on a scene edge) are
  labeled **unverifiable**, not hidden or guessed at.
- Bounding boxes are capped at 750 km² to keep in-memory processing bounded.

## License

MIT — see [LICENSE](LICENSE).
