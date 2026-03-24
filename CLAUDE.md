# IdeaVault

AI-powered note-taking app. Cloudflare Workers monorepo (Workers + Pages + D1 + KV).

## Structure

```
workers/auth/    → POST /register, POST /login, GET /me — JWT auth, PBKDF2 passwords
workers/notes/   → CRUD notes, tags, projects, connections — D1
workers/parser/  → POST /parse {url} — fetch + Readability + AI summary + save
workers/ai/      → /summarize /classify /suggestions /expand /connections /chat /settings
apps/web/        → React + Vite + shadcn/ui → Cloudflare Pages
packages/db/     → D1 migrations (0001_init.sql)
```

## Local Dev

```bash
npm run dev   # starts all 5 processes (wrangler×4 + vite)
```

Workers: auth=8787, notes=8788, parser=8789, ai=8790, web=5173

All workers share one local D1 at `.wrangler/state/` (via `--persist-to ../../.wrangler/state`).

After wiping state, re-apply migrations:
```bash
cd workers/notes && npx wrangler d1 execute ideavault --local --persist-to ../../.wrangler/state --file=../../packages/db/migrations/0001_init.sql
```

## Secrets

Each worker has `.dev.vars` for local secrets. **Never commit these.**

- `workers/auth/.dev.vars` — `JWT_SECRET`
- `workers/notes/.dev.vars` — `JWT_SECRET`, `AI_WORKER_URL`
- `workers/parser/.dev.vars` — `JWT_SECRET`, `AI_WORKER_URL`, `NOTES_WORKER_URL`
- `workers/ai/.dev.vars` — `JWT_SECRET`, `OPENAI_API_KEY`, `NOTES_WORKER_URL`

All workers share the same `JWT_SECRET` value.

## Deploy

```bash
npm run deploy:all    # deploy all workers + web
npm run deploy:auth   # deploy single worker
```

Production worker URLs: `https://ideavault-{auth,notes,parser,ai}.ideavault.workers.dev`
Frontend: `https://ideavault.pages.dev`

## D1 Database

ID: `0c29c45e-c89f-45b8-b422-b4ccc6bdf235`, name: `ideavault`
KV namespace: `c3e6747c835b406c887b5d66d2bd6330` (AI settings per user)

Tables: `users`, `notes`, `tags`, `note_tags`, `projects`, `project_notes`, `connections`

## Key Design Decisions

- Workers call each other via HTTP (parser → ai → notes). In local dev, these use localhost URLs from `.dev.vars`.
- AI settings (model, prompts) stored per-user in KV, editable via `/settings` page.
- Connections feature: async semantic link discovery on note save (`waitUntil`).
- Streaming responses (SSE) for `/expand` and `/chat` endpoints.
