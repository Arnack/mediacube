# Deploy Guide

## Prerequisites
- Cloudflare account (free): https://dash.cloudflare.com/sign-up
- `wrangler` installed: `npm install -g wrangler`
- Login: `wrangler login`
- OpenAI API key in `.env`

## 1. Create Cloudflare resources

```bash
# D1 database
wrangler d1 create ideavault
# Copy the database_id from output

# KV namespace (for AI settings)
wrangler kv:namespace create AI_SETTINGS
# Copy the id from output
```

## 2. Update wrangler.toml files

In `workers/auth/wrangler.toml`, `workers/notes/wrangler.toml`, `workers/ai/wrangler.toml`:
- Replace `REPLACE_WITH_D1_DATABASE_ID` with your database_id

In `workers/ai/wrangler.toml`:
- Replace `REPLACE_WITH_KV_NAMESPACE_ID` with your KV namespace id

## 3. Run DB migrations

```bash
wrangler d1 migrations apply ideavault --local  # local dev
wrangler d1 migrations apply ideavault          # production
```

The migration file is at `packages/db/migrations/0001_init.sql`.

## 4. Set secrets (run once per worker)

```bash
# Auth worker
cd workers/auth
echo "your-jwt-secret-min-32-chars" | wrangler secret put JWT_SECRET

# Notes worker
cd workers/notes
echo "your-jwt-secret-min-32-chars" | wrangler secret put JWT_SECRET

# Parser worker
cd workers/parser
echo "your-jwt-secret-min-32-chars" | wrangler secret put JWT_SECRET

# AI worker
cd workers/ai
echo "your-jwt-secret-min-32-chars" | wrangler secret put JWT_SECRET
echo "sk-..." | wrangler secret put OPENAI_API_KEY
```

## 5. Deploy workers

```bash
cd workers/auth && wrangler deploy
cd workers/notes && wrangler deploy
cd workers/parser && wrangler deploy
cd workers/ai && wrangler deploy
```

Note the deployed URLs (e.g. `https://ideavault-auth.YOUR_ACCOUNT.workers.dev`).

## 6. Update worker URLs

In `workers/notes/wrangler.toml`: set `AI_WORKER_URL`
In `workers/parser/wrangler.toml`: set `AI_WORKER_URL` and `NOTES_WORKER_URL`
In `workers/auth/wrangler.toml`: set `NOTES_WORKER_URL`

Re-deploy workers after updating vars.

## 7. Deploy frontend

```bash
# Create .env file
cp apps/web/.env.example apps/web/.env
# Fill in your worker URLs

# Build & deploy
wrangler pages deploy apps/web/dist --project-name ideavault
```

## Local development

Run each worker locally (different ports):

```bash
# Terminal 1
cd workers/auth && wrangler dev --port 8787

# Terminal 2
cd workers/notes && wrangler dev --port 8788

# Terminal 3
cd workers/parser && wrangler dev --port 8789

# Terminal 4
cd workers/ai && wrangler dev --port 8790

# Terminal 5 (frontend)
vite  # from repo root
```
