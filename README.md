# Composited video player

Next.js app: **Three.js** preview (background + padded, rounded video), **word-synced transcript** with skip/select, **mock APIs** for transcript and media URLs.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Assets

| Path | Role |
|------|------|
| `public/video.mp4` | Main video |
| `public/background.jpg` | Backplate in the scene |
| `public/data/transcript.json` | Word-level transcript (served via API) |

## APIs

- `GET /api/transcript` → `{ transcript: { text, words[] } }`
- `GET /api/media-metadata` → `{ videoUrl, backgroundUrl }`