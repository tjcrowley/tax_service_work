# Lacerte Integration Plan
# Katie's Tax Relief CRM

**Prepared:** 2026-05-27
**Author:** Darren McKeeman

---

## What Lacerte Actually Is (and Isn't)

Lacerte is a **Windows-only desktop tax preparation application**. It has no REST API and no cloud sync. Intuit does publish a Lacerte SDK, but it is a Windows COM component — not accessible from Node.js or any cloud service directly.

This means "integrate with Lacerte" requires a Windows intermediary. The rest of this document covers the realistic paths and recommends the right one for Katie's team.

---

## What We Want to Sync

The CRM and Lacerte hold overlapping but distinct data:

| Data | Lives in CRM | Lives in Lacerte | Sync direction |
|---|---|---|---|
| Client name, address, phone, email | ✓ | ✓ | CRM → Lacerte (new client created) |
| SSN / TIN | ✗ (not stored in CRM) | ✓ | Lacerte only |
| Tax debt amount, affected years | ✓ (CRM estimate) | ✓ (actual) | Lacerte → CRM (update with actuals) |
| IRS issue type | ✓ | ✓ | Lacerte → CRM |
| Return status (filed, in progress, etc.) | ✗ | ✓ | Lacerte → CRM (read-only) |
| Resolution / case closed | ✓ | ✓ | Bidirectional |
| Documents (IRS notices, POA, returns) | ✓ (DO Spaces) | ✓ (local file) | No sync — separate systems |

**Core sync use cases:**
1. New client signed in CRM → pre-populate Lacerte client file (avoid re-entering name/contact info)
2. Lacerte return status → update CRM pipeline stage automatically
3. Case resolved in Lacerte → close contact in CRM

---

## Integration Approaches

### Option A — Windows Bridge Service (Recommended)

Run a lightweight **Windows service on the tax workstation(s)** that:
- Wraps the Lacerte SDK (COM) via a .NET or Node.js edge process
- Exposes a small local REST API (`localhost:4000`)
- The CRM backend calls the bridge over a VPN/tunnel (or the bridge polls the CRM)

**Pros:** Real-time sync, bidirectional, full access to Lacerte data  
**Cons:** Requires Windows machine always running; .NET or `edge-js` dependency; Lacerte SDK license required

**Tech stack for bridge service:**
- Language: C# (.NET 8) — best native COM interop, or Node.js with `edge-js`
- Lacerte SDK: `Lacerte.SDK.dll` (downloaded from developer.intuit.com — requires Intuit developer account)
- Tunneling: Cloudflare Tunnel or ngrok to expose bridge to CRM backend without VPN setup
- Auth: shared secret (HMAC header) between bridge and CRM backend

**Data flow:**

```
CRM Backend (DO)
     │
     │  HTTPS + HMAC auth
     ▼
Cloudflare Tunnel
     │
     ▼
Bridge Service (Windows PC)
     │  COM interop
     ▼
Lacerte SDK
     │
     ▼
Lacerte Database (local ODBC)
```

---

### Option B — ODBC Direct Query

Lacerte stores data in a local SQL Server / ODBC database. A Node.js service on the same Windows machine can query it directly using `mssql` or `odbc` npm packages.

**Pros:** No SDK license needed, simpler than COM interop  
**Cons:** ODBC schema is undocumented/unsupported by Intuit; breaks on Lacerte version upgrades; read-only in practice

**Verdict:** Fragile. Don't build on this.

---

### Option C — CSV Export Workflow (Fallback / MVP)

Lacerte can export client data to CSV. Build a simple import page in the CRM that accepts Lacerte CSV exports and syncs contact records.

**Pros:** Zero infrastructure, works today, no Windows service to maintain  
**Cons:** Manual (someone exports + uploads), not real-time, one-way (CRM ← Lacerte only)

**Verdict:** Good enough for a 2-person team. Build this first as an interim solution.

---

## Recommended Plan: CSV Now, Bridge Later

Given Katie's team starts at 2 people, the right sequence is:

### Phase A — CSV Sync (build in 1-2 days, fits in Phase 8 or as Phase 13)

Extend the existing CSV import (Phase 8) to understand **Lacerte's specific export format**:

1. Export a sample CSV from Lacerte (Katie provides this)
2. Add a "Lacerte import" template to the field-mapping UI — pre-map Lacerte column headers to CRM fields
3. Deduplicate on SSN (add `ssn` or `tax_id` field to contacts — hashed/encrypted at rest) or full name + DOB
4. CRM → Lacerte: generate a CSV in Lacerte's import format from CRM contacts so the agent can drag it into Lacerte's import wizard

**What to add to the CRM:**
- `contacts.tax_id` column (AES-256 encrypted in DB, never returned in API except to admin)
- `contacts.lacerte_client_id` column (Lacerte's internal client number, for future bridge sync)
- Lacerte-flavored CSV export button on `/contacts`

---

### Phase B — Bridge Service (build when team > 5 people or Katie requests automation)

**Prerequisites before starting:**
1. Katie obtains Lacerte SDK license from Intuit (developer.intuit.com — requires Lacerte subscription)
2. Decide: VPN or Cloudflare Tunnel for bridge connectivity
3. Confirm: which Windows machine(s) will run the bridge (tax workstations)

**Bridge service implementation:**
- Repo: add `lacerte-bridge/` to monorepo
- Stack: C# .NET 8 minimal API (`dotnet new web`)
- Two endpoints:
  - `GET /clients` — list all Lacerte clients (id, name, status)
  - `POST /clients` — create new Lacerte client from CRM data
  - `GET /clients/:id/status` — fetch return filing status
- CRM backend additions:
  - `POST /integrations/lacerte/push/:contactId` — push CRM contact to Lacerte
  - `POST /integrations/lacerte/pull/:contactId` — pull Lacerte status into CRM
  - `POST /integrations/lacerte/webhook` — bridge calls this when Lacerte data changes

---

## What to Build Right Now (Phase 13 in BUILD_WORKFLOW.md)

**Phase 13 — Lacerte CSV Sync**

**Goal:** Agents can import Lacerte client exports and export CRM contacts to Lacerte format.

**Tasks:**
1. Add `tax_id` (encrypted) and `lacerte_client_id` columns to contacts schema + migration
2. Add Lacerte CSV template to field-mapping UI (Phase 8's import flow): pre-maps "Client ID", "First Name", "Last Name", "SSN/EIN", "Phone", "Email", "Address" headers
3. Export endpoint: `GET /contacts/export/lacerte` — returns CSV in Lacerte import format (filtered by `lacerte_client_id IS NULL` = not yet in Lacerte)
4. Export button on `/contacts` page (admin + agent) — downloads the CSV
5. Store `lacerte_client_id` when set during import

**Verify:** Upload a real Lacerte CSV export → contacts created/updated in CRM. Use export button → download CSV, import it into Lacerte without errors.

**Estimated effort:** 1 day of agent time

---

## Open Questions for Katie

Before building Phase 13 or B:

1. **Does Katie's firm already use Lacerte?** (or considering it?) If not, this entire integration is premature.
2. **What version of Lacerte?** SDK compatibility varies by version.
3. **Can Katie export a sample client CSV from Lacerte?** Needed to map columns accurately.
4. **Who manages the Windows workstation(s)?** Bridge service needs someone to install/maintain it.
5. **Should SSN be stored in the CRM at all?** Tax data is sensitive. Alternative: CRM stores Lacerte client ID only, no SSN.

---

## Security Notes

- SSN/TIN must be **encrypted at rest** (AES-256) if stored — never in plaintext in the DB
- The bridge service must use **mutual auth** (HMAC shared secret or mTLS) — it has direct DB access
- Lacerte data is tax-sensitive but **not HIPAA** — standard security practices apply
- Consider whether the CRM needs to be **SOC 2** compliant if handling SSNs at scale

---

## Summary

| Approach | Effort | Automation | Reliability | When to use |
|---|---|---|---|---|
| CSV export/import | Low | Manual | High | Now (2-person team) |
| ODBC direct | Medium | Automated | Fragile | Avoid |
| Windows bridge service | High | Real-time | Good | When team > 5 or Katie requests |

**Recommended next step:** Ask Katie if she uses Lacerte and get a sample CSV export. Build Phase 13 (CSV sync) in parallel with or after phases 6–10.
