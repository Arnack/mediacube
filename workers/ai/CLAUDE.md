# worker-ai

Handles all OpenAI calls + user AI settings. Port 8790 locally.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /settings | Get user's model + prompts |
| PUT | /settings | Update model/prompts |
| DELETE | /settings | Reset to defaults |
| POST | /summarize | Summarize article text |
| POST | /classify | Suggest tags for a note |
| POST | /suggestions | Suggest new ideas from recent notes |
| POST | /expand | Expand note into project outline (SSE) |
| POST | /connections | Find semantic links between all user notes |
| POST | /chat | Chat with notes as context (SSE) |

`/summarize` and `/connections` also accept `X-Internal: 1` header (called by other workers — skips JWT check but still requires the header).

## Bindings

- `DB` — D1 (reads notes/connections tables directly)
- `AI_SETTINGS` — KV (stores per-user settings as `settings:{userId}`)
- `JWT_SECRET`, `OPENAI_API_KEY` — secrets

## Prompts

Defaults in `src/defaults.ts`. Users can override per-prompt via `/settings`. Stored in KV.

## Streaming

`/expand` and `/chat` stream via SSE. Use `TransformStream` + `ReadableStream` — do not buffer the full response.
