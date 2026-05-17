# Agent Notes

## Project type
Zero-build static site. No package manager, bundler, tests, or build step. Open `index.html` directly in a browser to run.

## Dependencies
Loaded from CDN in `index.html`:
- `piexifjs@1.0.6` — EXIF read/write
- `jszip@3.10.1` — ZIP generation
- `Press Start 2P` font — Google Fonts

## Deploy
Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/pages.yml`. The workflow uploads the entire repo root as a static artifact.

## Architecture
- `js/script.js` — single IIFE with all app logic
- `css/style.css` — all styles
- `assets/` — favicon and loader gif only

## Domain logic agents often miss
- **Filename numbers drive everything**: images must contain a number (e.g. `000283.png`). Files are sorted by that number, and dates are interpolated linearly between Start/End based on it.
- **Trim values are "Game Boy dots"**: the UI inputs are dot counts, which get multiplied by the "Scale" factor to produce pixel trims. Default scale auto-detects from image width using 160 px or 128 px as base widths.
- **Output format**: processed images are saved as JPEG (quality 1.0) with EXIF `DateTimeOriginal`, `DateTimeDigitized`, and `DateTime` injected. Filenames become `GB_Camera_YYYYMMDD_HHMMSS.jpg`.
- **Settings persistence**: `localStorage` keys `gbcam_settings` and `gbcam_gallery_collapsed`.
- **Pixel-art rendering**: every canvas context must set `imageSmoothingEnabled = false`. The app deals with upscaled Game Boy pixel art; smoothing destroys the look.
