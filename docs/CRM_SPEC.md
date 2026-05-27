# Tax Resolution CRM — Technical Specification

**Project:** Katie's Tax Relief Company (name TBD)
**Prepared:** 2026-05-27
**Author:** Darren McKeeman (technical lead)

---

## Overview

A custom React PWA CRM for an all-female tax resolution company. Manages leads from first contact through IRS resolution. Starts at 2 users, architected to scale to 50. Tight Twilio integration for outbound calling and SMS. Separate from the marketing website.

---

## Architecture

```
┌─────────────────────────┐    ┌─────────────────────────┐
│   Marketing Website     │    │        CRM App          │
│   (Next.js static)      │    │    (React PWA)          │
│   crm.domain.com/       │    │   app.domain.com/       │
│   Lead form → webhook   │───▶│   Fastify REST API      │
└─────────────────────────┘    │   PostgreSQL (DO)       │
                               │   Twilio (calls/SMS)    │
                               │   DO Spaces (docs)      │
                               └─────────────────────────┘
```

### Frontend
- **Framework:** React 18 + Vite
- **PWA:** `vite-plugin-pwa` (Workbox) — installable, works offline for read-only
- **Styling:** Tailwind CSS
- **State/data:** TanStack Query (React Query) + Zustand for UI state
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod validation
- **Tables:** TanStack Table
- **Charts:** Recharts
- **Build target:** ES2020, deployed to DigitalOcean App Platform (static)

### Backend
- **Framework:** Fastify (Node.js 20)
- **Database ORM:** Drizzle ORM
- **Database:** PostgreSQL 15 (DigitalOcean Managed DB)
- **Auth:** JWT access tokens (15min) + refresh tokens (7d), httpOnly cookies
- **File storage:** DigitalOcean Spaces (S3-compatible), signed URLs
- **Phone/SMS:** Twilio Programmable Voice + Messaging API
- **Email:** SendGrid (notifications, automated follow-ups)
- **Deployed:** DigitalOcean App Platform (Node.js service)

### Monorepo Layout
```
tax_service_work/
├── crm/
│   ├── frontend/          # React PWA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── lib/
│   │   ├── public/
│   │   └── vite.config.ts
│   └── backend/           # Fastify API
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── db/
│       │   └── lib/
│       └── drizzle/       # migrations
├── website/               # Next.js static marketing site
│   └── mockups/           # Done
├── shared/                # Shared types (zod schemas)
└── docs/
```

---

## Data Model

### Leads / Contacts

```sql
-- Core entity: a person in the pipeline
contacts (
  id uuid PK,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- Identity
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,        -- E.164 format
  
  -- IRS situation
  tax_debt_amount numeric,    -- estimated amount owed
  tax_years text[],           -- affected years
  irs_issue_type text,        -- wage_garnishment | bank_levy | lien | back_taxes | unfiled_returns | other
  
  -- Pipeline
  status text NOT NULL,       -- lead | prospect | client | resolved | lost
  pipeline_stage text,        -- new | contacted | qualified | proposal | negotiating | resolution | closed
  assigned_to uuid FK users,
  source text,                -- website | purchased_list | referral | social | other
  source_detail text,
  
  -- Address
  city text,
  state char(2),
  zip text,
  
  -- Flags
  is_duplicate boolean DEFAULT false,
  do_not_call boolean DEFAULT false,
  do_not_sms boolean DEFAULT false
)

activities (
  id uuid PK,
  contact_id uuid FK contacts,
  user_id uuid FK users,
  created_at timestamptz,
  type text,     -- call | sms | email | note | stage_change | document | task_complete
  direction text, -- inbound | outbound (calls/sms)
  duration_seconds int,  -- calls
  body text,             -- note text, SMS body, call summary/transcript
  twilio_call_sid text,
  twilio_message_sid text,
  recording_url text
)

tasks (
  id uuid PK,
  contact_id uuid FK contacts,
  assigned_to uuid FK users,
  created_by uuid FK users,
  created_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  title text NOT NULL,
  description text,
  priority text  -- high | normal | low
)

documents (
  id uuid PK,
  contact_id uuid FK contacts,
  uploaded_by uuid FK users,
  uploaded_at timestamptz,
  filename text NOT NULL,
  mime_type text,
  size_bytes int,
  spaces_key text NOT NULL,   -- DO Spaces path
  category text,  -- irs_notice | poa | tax_return | correspondence | other
  notes text
)

users (
  id uuid PK,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL,  -- admin | agent | viewer
  phone text,
  twilio_worker_sid text,    -- for call routing
  is_active boolean DEFAULT true,
  created_at timestamptz
)

lead_imports (
  id uuid PK,
  uploaded_by uuid FK users,
  uploaded_at timestamptz,
  filename text,
  row_count int,
  imported_count int,
  duplicate_count int,
  error_count int,
  status text  -- processing | complete | failed
)
```

---

## Feature Modules

### 1. Lead Pipeline (Kanban)
- Drag-and-drop Kanban board: New → Contacted → Qualified → Proposal → Negotiating → Resolution → Closed
- Card shows: name, phone, debt amount, assigned agent, last activity date
- Filter by: assigned agent, source, date range, debt range
- Quick actions: log call, send SMS, add task — directly from card

### 2. Contact Detail View
- Header: name, phone (click-to-call), email, status badge, assigned agent
- Timeline: all activities in reverse chrono — calls (w/ recording playback), SMS, notes, doc uploads, stage changes
- Quick log panel: one-click log note / send SMS / make call
- Tasks sidebar: upcoming + overdue tasks for this contact
- Documents tab: upload, categorize, download

### 3. Click-to-Call (Twilio)
- Agent clicks phone number → Twilio outbound call bridges to agent's phone or browser (Twilio Client JS SDK)
- Call is logged automatically with duration
- Post-call: prompt agent for disposition + notes
- Voicemail detection: auto-leave pre-recorded voicemail, log as activity
- Inbound calls: routed by Twilio to available agent, logged with contact lookup by caller ID

### 4. SMS
- Send/receive SMS per contact
- Conversation view (chat bubble layout) in contact timeline
- Auto-log all inbound messages to contact record (Twilio webhook)
- Canned responses (team-editable templates)
- Opt-out handling: keyword STOP auto-sets do_not_sms

### 5. Lead Import (CSV/Bulk)
- Upload CSV with field mapping UI
- Duplicate detection: match on phone (E.164 normalized) + email
- Preview before import (first 10 rows + summary)
- Background job processes large files; UI polls for completion
- Import history log with error report download

### 6. Dashboard
- Today: calls made, SMS sent, new leads, tasks due
- Pipeline summary: count + total debt by stage
- Agent leaderboard: calls, contacts per agent
- Lead source breakdown (pie)
- Conversion funnel (leads → clients)
- Date range picker (today / 7d / 30d / 90d / custom)

### 7. Task Manager
- Personal task list (My Tasks) with overdue highlighting
- Team task view (admin only)
- Filter: overdue / today / upcoming / all
- Assign to any active user
- Link to contact (required)

### 8. Settings (Admin)
- User management: invite, deactivate, role assignment
- Pipeline stages: add/rename/reorder (text labels only, not add/remove — fixed count)
- Canned SMS responses: add/edit/delete
- Twilio configuration: phone numbers, voicemail recording upload
- Lead sources: configurable list

---

## PWA Requirements
- App shell cached via service worker (Workbox)
- Contact list + detail: readable offline (stale cache)
- Write operations (log note, create task): queued offline, sync on reconnect
- Installable: Web App Manifest with icons at 192px + 512px (branding TBD)
- Push notifications (future phase): task reminders, inbound lead alerts

---

## Auth & Permissions

| Feature | viewer | agent | admin |
|---|---|---|---|
| View contacts | ✓ | ✓ | ✓ |
| Edit contacts | | ✓ | ✓ |
| Make calls / send SMS | | ✓ | ✓ |
| Import leads | | ✓ | ✓ |
| View all agents' contacts | | ✓ | ✓ |
| User management | | | ✓ |
| Settings | | | ✓ |
| Reports (all agents) | | | ✓ |

---

## API Routes (summary)

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /contacts              ?status=&stage=&assigned=&page=&limit=
POST   /contacts
GET    /contacts/:id
PATCH  /contacts/:id
DELETE /contacts/:id

GET    /contacts/:id/activities
POST   /contacts/:id/activities        (log note)
GET    /contacts/:id/tasks
POST   /contacts/:id/tasks
GET    /contacts/:id/documents
POST   /contacts/:id/documents         (upload → DO Spaces)

POST   /calls/outbound                 (initiate Twilio call)
POST   /twilio/voice-webhook           (Twilio TwiML callback)
POST   /twilio/sms-webhook             (inbound SMS)
POST   /twilio/recording-webhook       (recording complete)

GET    /tasks                          (my tasks)
PATCH  /tasks/:id
DELETE /tasks/:id

POST   /imports                        (upload CSV)
GET    /imports/:id                    (poll status)

GET    /dashboard/summary
GET    /dashboard/funnel
GET    /dashboard/agents

GET    /users                          (admin)
POST   /users/invite
PATCH  /users/:id

GET    /settings
PATCH  /settings
```

---

## Environment Variables

### Backend
```
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_TWIML_APP_SID=
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_BUCKET=
DO_SPACES_REGION=
SENDGRID_API_KEY=
FRONTEND_URL=
```

### Frontend
```
VITE_API_URL=
VITE_TWILIO_TOKEN_ENDPOINT=
```

---

## Branding Placeholder
Logo, color palette, and typography are pending Katie's branding decision.
- CRM uses a neutral gray/white base by default
- Brand accent color is parameterized as a single Tailwind config value (`brand-500`)
- Swap in final colors without touching component code

---

## Open Items
1. Company name / domain — needed before DO App Platform setup
2. Twilio account — who owns it? Katie or Darren managing?
3. SendGrid sender domain — needs DNS verification on final domain
4. Will agents take calls on mobile (Twilio Client) or bridge to cell phone?
5. Any HIPAA/PCI requirements? (Tax data = sensitive but not HIPAA; no card processing in CRM)
