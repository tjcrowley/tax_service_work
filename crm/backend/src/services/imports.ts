import Papa from 'papaparse';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { contacts, type NewContactRow } from '../db/schema/contacts.js';
import { leadImports } from '../db/schema/lead_imports.js';

const CANONICAL_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'taxDebtAmount',
  'city',
  'state',
  'zip',
  'sourceDetail',
] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const CANONICAL_FIELD_LIST: readonly CanonicalField[] = CANONICAL_FIELDS;

export type ImportMapping = Partial<Record<CanonicalField, string>>;

export type ImportRowError = {
  row: number;
  reason: string;
};

const HEADER_GUESS_MAP: Record<string, CanonicalField> = {
  firstname: 'firstName',
  'first name': 'firstName',
  first: 'firstName',
  fname: 'firstName',
  lastname: 'lastName',
  'last name': 'lastName',
  last: 'lastName',
  lname: 'lastName',
  surname: 'lastName',
  email: 'email',
  'e-mail': 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  cell: 'phone',
  amount: 'taxDebtAmount',
  debt: 'taxDebtAmount',
  'tax debt': 'taxDebtAmount',
  'debt amount': 'taxDebtAmount',
  city: 'city',
  state: 'state',
  zip: 'zip',
  zipcode: 'zip',
  'zip code': 'zip',
  postal: 'zip',
  source: 'sourceDetail',
  'source detail': 'sourceDetail',
};

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    const target = HEADER_GUESS_MAP[key];
    if (target && !mapping[target]) {
      mapping[target] = header;
    }
  }
  return mapping;
}

export function parseCsv(text: string): Papa.ParseResult<Record<string, string>> {
  return Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
}

export function normalizePhone(raw: string, defaultCountry: 'US' = 'US'): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

function normalizeAmount(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

export type RawCsvRow = Record<string, string>;

export type NormalizedRow = {
  row: NewContactRow;
  email: string | null;
  phone: string;
};

export function normalizeRow(
  raw: RawCsvRow,
  mapping: ImportMapping,
): { ok: true; data: NormalizedRow } | { ok: false; reason: string } {
  const get = (field: CanonicalField): string | undefined => {
    const header = mapping[field];
    if (!header) return undefined;
    return raw[header];
  };

  const firstName = (get('firstName') ?? '').trim();
  const lastName = (get('lastName') ?? '').trim();
  if (!firstName || !lastName) return { ok: false, reason: 'Missing first or last name' };

  const phoneRaw = (get('phone') ?? '').trim();
  if (!phoneRaw) return { ok: false, reason: 'Missing phone number' };
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, reason: `Invalid phone: ${phoneRaw}` };

  const emailRaw = (get('email') ?? '').trim().toLowerCase();
  const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

  const state = (get('state') ?? '').trim().toUpperCase().slice(0, 2) || null;

  const row: NewContactRow = {
    firstName,
    lastName,
    email,
    phone,
    taxDebtAmount: normalizeAmount(get('taxDebtAmount')),
    city: (get('city') ?? '').trim() || null,
    state,
    zip: (get('zip') ?? '').trim() || null,
    status: 'lead',
    pipelineStage: 'new',
    source: 'purchased_list',
    sourceDetail: (get('sourceDetail') ?? '').trim() || null,
  };

  return { ok: true, data: { row, email, phone } };
}

export type ProcessImportResult = {
  rowCount: number;
  imported: number;
  duplicates: number;
  errors: ImportRowError[];
};

export async function processImport(
  importId: string,
  csvText: string,
  mapping: ImportMapping,
): Promise<ProcessImportResult> {
  const parsed = parseCsv(csvText);
  const rawRows = parsed.data ?? [];

  const errors: ImportRowError[] = [];
  const valid: NormalizedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const result = normalizeRow(row, mapping);
    if (!result.ok) {
      errors.push({ row: i + 2, reason: result.reason });
      continue;
    }
    valid.push(result.data);
  }

  const phones = Array.from(new Set(valid.map((v) => v.phone)));
  const emails = Array.from(
    new Set(valid.map((v) => v.email).filter((e): e is string => !!e)),
  );

  let existingPhoneSet = new Set<string>();
  let existingEmailSet = new Set<string>();

  if (phones.length || emails.length) {
    const orParts = [];
    if (phones.length) orParts.push(inArray(contacts.phone, phones));
    if (emails.length) orParts.push(inArray(contacts.email, emails));
    const where = orParts.length === 1 ? orParts[0] : or(...orParts);
    const existing = await db
      .select({ phone: contacts.phone, email: contacts.email })
      .from(contacts)
      .where(where);
    existingPhoneSet = new Set(existing.map((e) => e.phone));
    existingEmailSet = new Set(
      existing.map((e) => e.email).filter((e): e is string => !!e),
    );
  }

  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const toInsert: NewContactRow[] = [];
  let duplicates = 0;
  for (const v of valid) {
    if (existingPhoneSet.has(v.phone) || (v.email && existingEmailSet.has(v.email))) {
      duplicates += 1;
      continue;
    }
    if (seenPhone.has(v.phone) || (v.email && seenEmail.has(v.email))) {
      duplicates += 1;
      continue;
    }
    seenPhone.add(v.phone);
    if (v.email) seenEmail.add(v.email);
    toInsert.push(v.row);
  }

  if (toInsert.length) {
    const CHUNK = 100;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(contacts).values(toInsert.slice(i, i + CHUNK));
    }
  }

  await db
    .update(leadImports)
    .set({
      status: 'complete',
      rowCount: rawRows.length,
      importedCount: toInsert.length,
      duplicateCount: duplicates,
      errorCount: errors.length,
    })
    .where(eq(leadImports.id, importId));

  return {
    rowCount: rawRows.length,
    imported: toInsert.length,
    duplicates,
    errors,
  };
}

export function buildErrorReportCsv(errors: ImportRowError[]): string {
  const header = 'row,reason\n';
  const lines = errors.map((e) => `${e.row},"${e.reason.replace(/"/g, '""')}"`).join('\n');
  return header + lines + (errors.length ? '\n' : '');
}
