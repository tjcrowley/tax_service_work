# Phases 6–10 Implementation Summary

**Date:** 2026-05-27
**Commits:** `ecd92d4` → `1d263a2` (one feat commit per phase)

---

## What was implemented

### Phase 6 — Twilio Click-to-Call + SMS

**Backend**
- `services/twilio.ts` — singleton client with startup credential validation (logs warning, does not crash if missing)
- `POST /calls/outbound` — creates Twilio outbound bridged call to agent's phone (`users.phone`), records, logs `activities` row with `twilio_call_sid`
- `POST /twilio/voice-webhook` — returns TwiML `<Dial>` to bridge to the contact and record from answer
- `POST /twilio/recording-webhook` — updates activity with `recording_url` and duration when Twilio finishes the recording
- `POST /twilio/status-webhook` — backfills final duration on call completion
- `POST /twilio/sms-webhook` — looks up contact by phone, inserts inbound sms activity, handles `STOP` keyword (sets `do_not_sms`)
- `POST /contacts/:id/sms` — sends outbound SMS, logs activity (refuses if `do_not_sms`)
- `GET /contacts/:id/sms` — returns full SMS thread (oldest→newest)
- `POST /twilio/dispositions/:callSid` — agent-supplied post-call disposition + notes appended to the call activity body

**Frontend**
- `CallButton` — click-to-call with "Calling…" pending state, opens `PostCallModal` on success
- `PostCallModal` — disposition dropdown (answered / voicemail / no-answer / busy / failed) + notes textarea
- `SmsPanel` — chat-bubble conversation view, auto-scroll, 10s poll, send box
- New "SMS" tab in `ContactDetail` (4 tabs total: Timeline / SMS / Tasks / Documents)
- `CallButton` is disabled with "DNC" badge when `contact.doNotCall` is true; `SmsPanel` shows opt-out notice when `do_not_sms` is true

---

### Phase 7 — Document Upload

**Backend**
- `services/spaces.ts` — DO Spaces S3-compatible client (`@aws-sdk/client-s3` + presigner) with startup credential validation
- `POST /contacts/:id/documents` — multipart upload (max 25MB), stores with key `contacts/{contactId}/{uuid}-{safeName}`, mime/size/category/notes persisted to `documents`, also logs a `document` activity row
- `GET /contacts/:id/documents` — list with category badge, uploader name (joined)
- `GET /contacts/:id/documents/:docId/download` — returns signed URL (15min TTL)

**Frontend**
- `lib/documents.ts` — typed API client + size formatter + category labels/colors
- `DocumentsPanel` — `react-dropzone` drag-and-drop, upload progress bar (axios `onUploadProgress`), category selector (IRS Notice / POA / Tax Return / Correspondence / Other), notes field, downloadable list

---

### Phase 8 — Lead Import (CSV)

**Backend**
- `services/imports.ts` — CSV parser (`papaparse`), header guesser, row normalizer (E.164 via `libphonenumber-js`, currency stripping, email validation, state ISO-2), dedup against existing contacts (phone OR email) and against itself
- `POST /imports/preview` — returns headers, first 10 rows, total row count, suggested mapping
- `POST /imports` — creates `lead_imports` row with `status='processing'`, returns 202; background job runs via `setImmediate`, normalizes/dedups/bulk-inserts (chunks of 100), updates row to `status='complete'` with counts
- `GET /imports/:id` — frontend polls for status
- `GET /imports/:id/errors.csv` — downloadable error report (in-memory map of failed rows per import id)
- `GET /imports` — admin import history

**Frontend**
- `/imports` 4-step flow: drag-and-drop upload → field mapping (with auto-suggestions) → preview (first 10 rows) → progress polling → completion summary with error-report link

---

### Phase 9 — Dashboard + Reports

**Backend**
- `GET /dashboard/summary` — KPI counts for date range: calls, sms, new leads, tasks due
- `GET /dashboard/funnel` — contacts grouped by pipeline stage (with sum of `tax_debt_amount`) + grouped by source
- `GET /dashboard/agents` — per-agent counts (calls / sms / contacts) for date range, joined with active users

**Frontend**
- `/` (home) replaced by `Dashboard` page:
  - 4 KPI cards
  - Recharts pipeline funnel bar chart with stage totals + debt tooltip
  - Lead source pie chart
  - Agent activity table
- Date range picker chips: Today / 7d / 30d / 90d

---

### Phase 10 — Admin Settings + User Management

**Backend**
- New tables added to `schema/settings.ts`: `canned_responses`, `lead_sources`, `user_invites`
- `services/email.ts` — SendGrid wrapper with startup validation
- `POST /admin/users/invite` (admin) — creates 48h-expiry `user_invites` row with random token, sends set-password email via SendGrid; if SendGrid unconfigured, returns the invite URL in the response so an admin can share it manually
- `POST /admin/users/accept-invite` — consumes token, sets bcrypt password, creates active `users` row, marks invite accepted
- `PATCH /admin/users/:id` — role change, deactivate, rename
- `GET /admin/users` + `GET /admin/invites` — admin only (403 for agent/viewer)
- `GET/POST/PATCH/DELETE /settings/canned-responses` — CRUD on SMS templates (read is auth-only; mutations are admin-only)
- `GET/POST/DELETE /settings/lead-sources` — same pattern

**Frontend**
- `/settings` — landing nav
- `/settings/users` — user table, invite modal, role dropdown, deactivate button
- `/settings/canned-responses` — add/edit/delete templates
- `/settings/lead-sources` — add/delete custom source labels
- `/accept-invite?token=…` — password setup form, auto-logs-in on success

---

## Deviations from spec

1. **Twilio call bridging.** The spec leaves this open ("agents take calls on mobile (Twilio Client) or bridge to cell phone?"). I implemented **bridge-to-cell**: backend dials the agent's `users.phone` first, then TwiML bridges to the contact. Twilio Client JS SDK was not needed. If you want browser-based calling later, the call route stays the same — only the TwiML and the frontend change.
2. **Background import job** runs in-process via `setImmediate` rather than as a separate worker. Fine for the 2-user starting point; revisit when team grows or imports exceed a few thousand rows.
3. **Import error report** is held in an in-memory `Map<importId, errors[]>`. Survives the process lifetime, not restarts. Cleanest fix is adding a `lead_import_errors` table, but it wasn't in the spec.
4. **Phone normalization** is hardcoded to `US`. Multi-country support is trivial (`libphonenumber-js` already handles it) but not requested.
5. **No DB migration was generated/run** for the three new tables (`canned_responses`, `lead_sources`, `user_invites`). The Drizzle schema files are committed; Darren needs to run `npm run db:generate && npm run db:migrate` once the database is reachable. (The existing repo had no `drizzle/` migrations folder either, suggesting the dev DB hasn't been bootstrapped yet.)
6. **Tests are route-level smoke tests** (auth required, validation rejects, service-unavailable when external creds missing). DB-touching paths (full CRUD round-trips, dedup with real rows, etc.) were not asserted because there's no test database. 36 backend + 6 frontend tests pass.
7. **Twilio webhook signature verification is not enforced.** In production you should add `twilio.webhook()` validator middleware to all `/twilio/*` routes once the production URL is in DNS. Marked for Phase 12 (deploy).
8. **Recharts version 3.x** changed Tooltip formatter signatures slightly — Dashboard funnel uses a cast through `unknown` to read `payload.debt`. Works fine, just not the cleanest typing.
9. **No multipart streaming to Spaces.** Files are buffered in memory before upload (capped at 25MB). For larger uploads, switch to streaming via `Upload` from `@aws-sdk/lib-storage`.

---

## Packages installed

### Backend
| Package | Why |
|---|---|
| `twilio` | Outbound calls + SMS |
| `@fastify/multipart@^8` | File uploads (downgraded from v10 for Fastify 4 compatibility) |
| `@fastify/formbody@^7` | Twilio webhook bodies are `application/x-www-form-urlencoded` |
| `@aws-sdk/client-s3` | DO Spaces (S3-compatible) put/get/delete |
| `@aws-sdk/s3-request-presigner` | Signed download URLs |
| `papaparse` + `@types/papaparse` | CSV parsing for lead import |
| `libphonenumber-js` | Phone normalization to E.164 |
| `@sendgrid/mail` | User invite emails |
| `vitest` + `@vitest/runner` | Test runner |

### Backend version pins
- `@fastify/multipart` pinned to `^8` (v10 requires Fastify 5; project is on Fastify 4)
- `@fastify/cookie` downgraded to `^9`, `@fastify/jwt` to `^8`, `@fastify/formbody` to `^7` — all originally installed at v5-only versions and would have failed to load on Fastify 4 at runtime. Fixed in Phase 6 commit.

### Frontend
| Package | Why |
|---|---|
| `recharts` | Dashboard charts |
| `react-dropzone` | Document + CSV drag-and-drop |
| `vitest` | Test runner |

---

## What Katie/Darren need to configure before these features work

### Twilio (Phase 6) — REQUIRED before launching call/SMS features
1. **Account ownership.** Per spec Open Items #2: confirm Katie owns the Twilio account (recommended) or Darren manages it.
2. Provision a Twilio phone number with Voice + SMS capabilities.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in production env.
4. Set `BACKEND_PUBLIC_URL` to the production backend URL (or use ngrok in dev) so webhooks resolve.
5. In Twilio console → Phone Number → Voice → configure incoming call webhook and recording status callback to point at `{BACKEND_PUBLIC_URL}/twilio/voice-webhook` and `{BACKEND_PUBLIC_URL}/twilio/recording-webhook`.
6. Same for SMS: messaging webhook → `{BACKEND_PUBLIC_URL}/twilio/sms-webhook`.
7. Each agent's `users.phone` must be in E.164 — that's the number Twilio bridges through.

### DO Spaces (Phase 7) — REQUIRED before document uploads
1. Create a Space in DigitalOcean (`nyc3` region recommended).
2. Generate Spaces access key + secret.
3. Set `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET`, `DO_SPACES_REGION` (and optionally `DO_SPACES_ENDPOINT`).
4. Bucket ACL should be private — signed URLs handle access.

### SendGrid (Phase 10) — Optional but recommended for invite UX
1. Create SendGrid account, get API key.
2. Verify a sender domain (per spec Open Items #3 — needs final domain DNS).
3. Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`.
4. Without SendGrid, the invite endpoint still works — it just returns the invite URL in the response so the admin can copy/paste/share it manually.

### Database (Phases 8, 10)
Three new tables in Phase 10's schema (`canned_responses`, `lead_sources`, `user_invites`) need migrations:

```bash
cd crm/backend
npm run db:generate   # produces drizzle/0001_*.sql
npm run db:migrate    # applies to DATABASE_URL
```

The pre-existing tables (`contacts`, `activities`, `tasks`, `documents`, `lead_imports`, `users`) appear to not have had migrations generated either — the existing `crm/backend/` had no `drizzle/` folder. Generate and apply all migrations against a fresh DB before running `npm run db:seed`.

---

## Test summary

```
$ cd crm/backend && npm test
 Test Files  8 passed (8)
      Tests  36 passed (36)

$ cd crm/frontend && npm test
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

Both workspaces also pass `npm run typecheck`.

---

## Open items deferred to later phases

- **Twilio webhook signature verification** — Phase 12 (deploy).
- **PWA / offline queueing for SMS send + note logging** — Phase 11.
- **Lead import errors persisted to DB** rather than in-memory.
- **Multi-country phone normalization** — easy add when needed.
- **Streaming large file uploads to Spaces** — only if user reports OOM on big PDFs.
- **Inbound call routing to an available agent** — currently inbound calls hit Twilio default routing; no in-app routing yet.
