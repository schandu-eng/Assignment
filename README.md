# Composited video player

Next.js app: **Three.js** preview (background + padded, rounded video), **word-synced transcript** with skip/select, **mock APIs** for transcript and media URLs.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (e.g. Vercel)

```bash
npm run build
```

Commit `public/video.mp4`, `public/background.jpg`, and `public/data/transcript.json` (or point [`app/api/media-metadata/route.ts`](app/api/media-metadata/route.ts) at hosted URLs). Large binaries may need [Git LFS](https://git-lfs.com) or external storage.

## Assets

| Path | Role |
|------|------|
| `public/video.mp4` | Main video |
| `public/background.jpg` | Backplate in the scene |
| `public/data/transcript.json` | Word-level transcript (served via API) |

## APIs

- `GET /api/transcript` → `{ transcript: { text, words[] } }`
- `GET /api/media-metadata` → `{ videoUrl, backgroundUrl }`

## Stack (short)

- **Compositor:** `@react-three/fiber` + `three` — background plane, shader-rounded video quad, shared `<video>` element.
- **Transcript:** RAF + ref-based active word (minimal React churn); Redux Toolkit for padding, radius, skips.
- **Playback:** HTML5 video + bar (seek, ±10s, 1×–2× speed).

**Smaller MP4 for dev:** e.g. `ffmpeg -i in.mp4 -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 23 -c:a aac -movflags +faststart -y public/video.mp4`
