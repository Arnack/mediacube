# worker-notes

CRUD for notes, tags, projects, connections. Port 8788 locally.

## Endpoints

- `GET/POST /notes` — list (filter: tag, type, search, page, limit) / create
- `GET/PUT/DELETE /notes/:id` — single note ops
- `GET/POST/DELETE /tags`, `DELETE /tags/:id`
- `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`
- `GET /connections` — list AI-found semantic links

## Bindings

- `DB` — D1 (all tables)
- `JWT_SECRET` — secret
- `AI_WORKER_URL` — var (calls `/connections` async on note create via `waitUntil`)

## Notes on Implementation

- `formatNote()` helper converts flat GROUP_CONCAT rows → `{ ...note, tags: [{id, name, color}] }`
- `attachTags()` upserts tags by name (lowercase) then links via `note_tags`
- Connection finding is fire-and-forget (`waitUntil`) — never blocks the create response
