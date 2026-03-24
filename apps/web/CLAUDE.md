# apps/web

React + Vite + shadcn/ui frontend. Port 5173 locally.

## Key Files

- `src/App.tsx` — router, PrivateRoute / PublicRoute guards
- `src/lib/api.ts` — all API calls (reads `VITE_*_URL` env vars)
- `src/hooks/useAuth.ts` — auth state (token in localStorage)
- `src/store/auth.ts` — auth store

## Env Vars

Set in `.env.local` for local dev:
```
VITE_AUTH_URL=http://localhost:8787
VITE_NOTES_URL=http://localhost:8788
VITE_PARSER_URL=http://localhost:8789
VITE_AI_URL=http://localhost:8790
```

Production values in `.env` (committed, no secrets).

## UI Stack

shadcn/ui components in `src/components/ui/`. Add new components with:
```bash
npx shadcn@latest add <component>
```

Tailwind config: `tailwind.config.js` (CJS, not ESM — required for path resolution from root).

## Build

```bash
npm run build   # tsc + vite build → dist/
```
