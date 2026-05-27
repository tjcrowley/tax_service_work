# CRM Build Workflow — Claude Code Agent Guide

This document describes how to build the CRM using Claude Code agents phase by phase.
Each phase is a self-contained unit of work with a clear input, output, and verification step.

**Model:** Use `claude-opus-4-7` for all implementation phases (heavy coding).

---

## Before You Start Each Phase

1. Read `docs/CRM_SPEC.md` — the spec is the source of truth
2. Read `shared/` for any existing Zod schemas before writing new ones
3. Commit at the end of every phase; never start a new phase on a dirty tree
4. Run `npm test` in both `crm/frontend` and `crm/backend` before committing

---

## Phase 0 — Monorepo Scaffold

**Goal:** Runnable skeleton. Nothing works yet but the dev server starts.

**Tasks:**
1. Init `crm/backend/` — Fastify + Drizzle + pg + Zod + dotenv; dev server on port 3001
2. Init `crm/frontend/` — Vite + React + TypeScript + Tailwind + `vite-plugin-pwa`; dev server on port 5173
3. Create `shared/types/` — empty index; add `shared` as workspace package in root `package.json`
4. Add root `package.json` with `npm workspaces` covering `crm/frontend`, `crm/backend`, `shared`
5. Add `.env.example` files in both backend and frontend (all keys from spec, no real values)
6. Add `README.md` at root with `npm run dev` instructions

**Verify:** `npm run dev` starts both servers with no errors. Browser opens `localhost:5173` showing Vite default page.

---

## Phase 1 — Database Schema + Migrations

**Goal:** All tables created and migrated against a local Postgres instance.

**Tasks:**
1. Write Drizzle schema files in `crm/backend/src/db/schema/` — one file per table: `contacts.ts`, `activities.ts`, `tasks.ts`, `documents.ts`, `users.ts`, `lead_imports.ts`
2. Reference `docs/CRM_SPEC.md` Data Model section exactly — column names, types, constraints
3. Add shared Zod schemas in `shared/types/` for Contact, Activity, Task, Document, User (used by both frontend and backend)
4. Generate and run migration: `npm run db:migrate`
5. Write seed script `crm/backend/src/db/seed.ts` — creates 1 admin user + 10 fake contacts with activities

**Verify:** `npm run db:seed` runs clean. `psql` query shows all tables populated. TypeScript types from Drizzle schema match the Zod types in `shared/`.

---

## Phase 2 — Auth

**Goal:** Login, JWT tokens, protected routes working end-to-end.

**Tasks:**
1. `POST /auth/login` — bcrypt password check, return access + refresh tokens as httpOnly cookies
2. `POST /auth/refresh` — validate refresh token, issue new access token
3. `POST /auth/logout` — clear cookies
4. Fastify auth hook: verify JWT on all non-auth routes; attach `req.user`
5. Frontend: `AuthContext` + `useAuth` hook; persists login state via React Query
6. Frontend: `/login` page (email + password form)
7. Frontend: Route guard — redirect unauthenticated users to `/login`

**Verify:** Login with seed admin user → lands on dashboard shell. Refresh page → still logged in. Hit `/contacts` API without token → 401. Logout → redirect to login.

---

## Phase 3 — Contact CRUD + Pipeline Kanban

**Goal:** Agents can create, view, edit, and move contacts through the pipeline.

**Tasks:**
1. Backend: all `/contacts` routes (list with pagination/filter, get, create, update, delete)
2. Frontend: `/contacts` — table view with search + filters (status, stage, assigned agent)
3. Frontend: `/pipeline` — Kanban board; drag-and-drop between stages using `@dnd-kit/core`
4. Frontend: `/contacts/:id` — detail view with header + tabbed layout (Timeline, Tasks, Documents)
5. Contact create/edit form (slide-over panel, not a separate page)
6. Stage change logs an activity automatically (backend side)

**Verify:** Create contact → appears in Kanban. Drag to next stage → stage updates in DB. Filter by agent → only their contacts show. Edit contact → changes persist on refresh.

---

## Phase 4 — Activity Timeline + Notes

**Goal:** Every contact has a full activity feed. Agents can log notes.

**Tasks:**
1. Backend: `GET /contacts/:id/activities` — reverse chrono, paginated
2. Backend: `POST /contacts/:id/activities` — log a note (type=note)
3. Frontend: Timeline component — renders each activity type differently:
   - Note: speech bubble with text + agent name
   - Stage change: compact pill with old→new
   - Call: phone icon + duration + outcome
   - SMS: message icon + body preview
   - Document: paperclip icon + filename
4. "Log Note" button in contact detail — inline textarea, submits, timeline refreshes

**Verify:** Log 3 notes on a contact → all appear in timeline newest-first. Reload page → still there. Stage change from Phase 3 appears in timeline automatically.

---

## Phase 5 — Tasks

**Goal:** Agents can create, assign, and complete follow-up tasks.

**Tasks:**
1. Backend: task routes (create, list by contact, list mine, update, delete)
2. Frontend: Tasks sidebar in contact detail — shows open tasks, overdue in red
3. Frontend: `/tasks` — My Tasks page, grouped by Overdue / Today / Upcoming
4. Task create modal: title, due date, assignee, priority
5. Complete task → logs a `task_complete` activity on the contact

**Verify:** Create task due yesterday → shows as overdue (red). Complete it → disappears from My Tasks, activity appears in contact timeline. Admin can see all agents' tasks from `/tasks?all=true`.

---

## Phase 6 — Twilio Click-to-Call + SMS

**Goal:** Agents can call and text contacts from inside the CRM. All comms auto-logged.

**Tasks:**
1. Backend: Twilio SDK setup, credential validation at startup
2. Backend: `POST /calls/outbound` — creates Twilio outbound call, returns call SID
3. Backend: `POST /twilio/voice-webhook` (TwiML) — connects call, records it
4. Backend: `POST /twilio/recording-webhook` — saves recording URL to activity
5. Backend: `POST /twilio/sms-webhook` — receives inbound SMS, finds contact by phone, creates activity
6. Backend: `POST /contacts/:id/sms` — sends outbound SMS, logs activity
7. Frontend: Click-to-call button on contact phone number → triggers call, shows "Calling..." state
8. Frontend: SMS panel in contact detail — conversation thread view, send box at bottom
9. Post-call modal: disposition dropdown (answered/voicemail/no-answer) + notes field

**Verify:** Click call button → Twilio API called (check logs). Inbound SMS to Twilio number → appears in correct contact's timeline within 5 seconds. Send SMS from CRM → delivery status shown.

---

## Phase 7 — Document Upload

**Goal:** Agents can upload and download client documents (IRS notices, POA, tax returns).

**Tasks:**
1. Backend: `POST /contacts/:id/documents` — multipart upload → DO Spaces, save metadata
2. Backend: `GET /contacts/:id/documents/:id/download` — generate signed URL (15min expiry)
3. Frontend: Documents tab in contact detail — list with category badge, upload button, download link
4. Drag-and-drop file upload with progress bar
5. Category selector on upload: IRS Notice / POA / Tax Return / Correspondence / Other

**Verify:** Upload a PDF → appears in list. Click download → file opens (signed URL works). Refresh → file still listed. Upload 5 files → all listed with correct categories.

---

## Phase 8 — Lead Import (CSV)

**Goal:** Agents can upload bulk lead lists from purchased sources.

**Tasks:**
1. Backend: `POST /imports` — accepts CSV multipart; immediately returns import ID; background job processes
2. Background job: normalize phone to E.164, deduplicate against existing contacts (phone + email), insert valid rows, track counts
3. Backend: `GET /imports/:id` — returns status + counts (frontend polls)
4. Frontend: `/imports` — upload page with drag-and-drop CSV zone
5. Frontend: Field mapping step — detect columns, let user map CSV headers to contact fields
6. Frontend: Preview step — first 10 rows + projected counts before confirming
7. Frontend: Progress polling after confirm → completion summary with error report download

**Verify:** Upload 100-row CSV → import completes, contacts appear in table. Re-upload same file → duplicates detected and skipped (not re-imported). Upload file with bad phone numbers → errors listed in downloadable report.

---

## Phase 9 — Dashboard + Reports

**Goal:** Admin has a real-time business overview.

**Tasks:**
1. Backend: `GET /dashboard/summary` — today's stats: calls, SMS, new leads, tasks due
2. Backend: `GET /dashboard/funnel` — count by pipeline stage
3. Backend: `GET /dashboard/agents` — per-agent activity counts for date range
4. Frontend: `/` (home) — dashboard with:
   - Today's KPI cards (calls, SMS, new leads, tasks due today)
   - Pipeline funnel bar chart (Recharts)
   - Lead source pie chart
   - Agent activity table
5. Date range picker: Today / 7d / 30d / 90d / Custom

**Verify:** Create 5 contacts with varying stages and sources → all counts reflected in dashboard. Switch date range → counts update. Agent table shows correct breakdown per agent.

---

## Phase 10 — Admin Settings + User Management

**Goal:** Admin can manage users and configure team-wide settings.

**Tasks:**
1. Backend: user invite (generate token, send via SendGrid), activate, deactivate, role change
2. Backend: settings endpoints (canned SMS responses, lead sources list)
3. Frontend: `/settings/users` — user list, invite modal, deactivate button
4. Frontend: `/settings/canned-responses` — add/edit/delete SMS templates
5. Frontend: `/settings/lead-sources` — configurable lead source labels
6. Invite flow: user receives email → clicks link → sets password → lands in CRM

**Verify:** Invite new user → email received (check SendGrid activity log). User sets password → can log in with agent role. Admin deactivates user → that user's login returns 401. Canned response saved → available in SMS send panel.

---

## Phase 11 — PWA Polish + Mobile

**Goal:** App installs on iOS/Android. Key flows work offline.

**Tasks:**
1. Configure Workbox in `vite-plugin-pwa`:
   - App shell: precache all JS/CSS/fonts
   - Contacts list: cache-first with 10min TTL
   - Contact detail: stale-while-revalidate
2. Offline write queue: log note + create task → queue in IndexedDB (via Workbox `BackgroundSync`) → replay on reconnect
3. Web App Manifest: name, short_name, theme_color (brand color), icons (placeholder until branding final)
4. Test installability on iOS Safari + Android Chrome
5. Add "offline" banner when service worker detects no network

**Verify:** Install app on phone → launches without browser chrome. Kill network → contact list still loads from cache. Log a note while offline → appears in queue → syncs when network returns.

---

## Phase 12 — Production Deploy

**Goal:** App running on DigitalOcean, accessible at final domain.

**Tasks:**
1. Create DigitalOcean App Platform app: backend (Node.js) + frontend (static) + managed Postgres
2. Configure all production env vars in DO dashboard
3. Set up DO Spaces bucket + CDN for documents
4. Point domain DNS to DO App Platform
5. Verify Twilio webhooks point to production backend URL
6. Smoke test all Phase 6 (Twilio) flows in production
7. Enable DO Managed DB daily backups

**Verify:** Load `app.domain.com` → login works. Make a test call → logged. Upload a document → downloadable. Dashboard shows data.

---

## Agent Prompt Template

When starting a phase, give the Claude Code agent this prompt:

```
You are implementing Phase N of a tax resolution CRM.

Read these files before writing any code:
- docs/CRM_SPEC.md (full spec)
- docs/BUILD_WORKFLOW.md (this file — Phase N section)
- shared/types/ (existing shared schemas)

Context:
- Monorepo: crm/frontend (React/Vite/Tailwind), crm/backend (Fastify/Drizzle/Postgres)
- Do not create new abstractions beyond what Phase N requires
- Match existing patterns in the codebase exactly
- Write TypeScript throughout, no `any` types
- All API responses use { data, error } envelope
- Tests: write at least one integration test per new API route

Implement Phase N — [Phase Title] exactly as described in BUILD_WORKFLOW.md.
Commit when all verification steps pass.
```

---

## Notes

- **Branding:** All colors go through `tailwind.config.ts` — `brand-500` is the single accent color. Update it when Katie picks branding; nothing else changes.
- **Twilio account ownership:** Confirm with Katie before Phase 6. Darren manages setup; Katie should own the account.
- **Domain:** Needed before Phase 12. Suggest `app.[domain].com` for CRM, `[domain].com` for website.
- **Scaling to 50 users:** Postgres connection pooling (PgBouncer) should be added before launch if team exceeds 10.
