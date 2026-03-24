# worker-auth

Registration, login, JWT issuance. Port 8787 locally.

## Endpoints

- `POST /register { email, password }` — creates user, returns JWT
- `POST /login { email, password }` — validates, returns JWT
- `GET /me` — returns current user (requires Bearer token)

## Bindings

- `DB` — D1 (`users` table only)
- `JWT_SECRET` — secret

## Auth Details

- Passwords: PBKDF2-SHA256, 100k iterations, random 16-byte salt
- JWT: HMAC-SHA256, `sub` = userId, 30-day expiry
- All other workers verify JWTs using the same `JWT_SECRET`
