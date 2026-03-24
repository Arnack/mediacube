# worker-parser

Fetches a URL, extracts article content, summarizes via AI, saves as a note. Port 8789 locally.

## Endpoint

`POST /parse { url }` — full pipeline:
1. Fetch URL with browser-like User-Agent
2. Parse HTML with `linkedom` + `@mozilla/readability`
3. `POST {AI_WORKER_URL}/summarize` (passes JWT through)
4. `POST {NOTES_WORKER_URL}/notes` to save
5. Return `{ note }`

## Bindings

- `JWT_SECRET` — secret (validates incoming JWT)
- `AI_WORKER_URL`, `NOTES_WORKER_URL` — vars (overridden in `.dev.vars` for local dev)

## Error Codes

- `400` — no URL
- `422` — fetch failed or Readability couldn't parse
- `500` — notes worker rejected the save
