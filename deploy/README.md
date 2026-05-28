# Deploy

Demo deployment for taxcrm.deaddogstudios.com.

## What's here
- `docker-compose.yml` — postgres + backend + nginx stack
- `Dockerfile.backend` — Node 20 alpine, installs workspaces, runs via `tsx`
- `nginx.conf` — serves built frontend, proxies `/api/` to backend
- `.env.example` — copy to `.env`, fill in real secrets (do NOT commit `.env`)

## First-time deploy
1. Build frontend locally: `VITE_API_URL=/api npm run build --workspace=@tax/frontend`
2. Generate secrets: `openssl rand -hex 32` for JWT_SECRET / JWT_REFRESH_SECRET; `openssl rand -hex 20` for POSTGRES_PASSWORD. Write to `deploy/.env`.
3. rsync repo to droplet (exclude `node_modules`, `.git`, `deploy/.env`); scp `.env` separately.
4. On droplet: `cd /opt/taxcrm/deploy && docker compose up -d --build`
5. Schema push (one-time): inside backend container, run `npx tsc -p tsconfig.json` then `npx drizzle-kit push --force` (drizzle config points at `dist/db/schema/index.js` to avoid ESM `.js` import resolution issues in drizzle-kit).
6. Seed: `docker compose exec -T backend sh -c "cd /app/crm/backend && npx tsx src/db/seed.ts"`
7. Fix perms after rsync from macOS: `chmod -R a+rX /opt/taxcrm/`

## Notes
- Drizzle config uses compiled `dist/` because drizzle-kit can't resolve `.js` import extensions on TS schema files in NodeNext.
- Seed user: `admin@example.com` / `admin123` — change in prod.
- Twilio / SendGrid / DO Spaces creds not configured; those features return 503.
