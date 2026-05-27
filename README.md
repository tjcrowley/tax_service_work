# tax_service_work

Katie's Company — Tax Resolution CRM monorepo.

## Monorepo Structure

```
tax_service_work/
├── website/        # Marketing & public-facing site (mockups)
├── crm/
│   ├── backend/    # Fastify API (Node.js 20, Drizzle ORM, Postgres)
│   └── frontend/   # React PWA (Vite, React 18, Tailwind)
├── shared/         # Shared TypeScript types + Zod schemas
└── docs/           # CRM_SPEC.md, BUILD_WORKFLOW.md
```

## Prerequisites

- Node.js >= 20
- npm (workspaces)
- PostgreSQL 15 (local or DigitalOcean Managed DB)

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Copy env files and fill in values
cp crm/backend/.env.example crm/backend/.env
cp crm/frontend/.env.example crm/frontend/.env

# Generate + run Drizzle migrations against your Postgres
npm run db:generate
npm run db:migrate

# Seed an admin user + 10 demo contacts
npm run db:seed

# Start both servers (backend :3001, frontend :5173)
npm run dev
```

Visit `http://localhost:5173`.

## Useful Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run backend (3001) and frontend (5173) in parallel |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Frontend only |
| `npm run db:generate` | Generate a new Drizzle migration from the schema |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:seed` | Insert seed admin + demo contacts |
| `npm run build` | Build all workspaces |

## Docs

- `docs/CRM_SPEC.md` — full technical specification
- `docs/BUILD_WORKFLOW.md` — phase-by-phase build plan
