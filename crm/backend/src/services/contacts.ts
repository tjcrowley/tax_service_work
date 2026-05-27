import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activities } from '../db/schema/activities.js';
import { contacts, type ContactRow, type NewContactRow } from '../db/schema/contacts.js';

export type ContactStatus = ContactRow['status'];
export type PipelineStage = NonNullable<ContactRow['pipelineStage']>;

export type ListContactsParams = {
  status?: ContactStatus;
  stage?: PipelineStage;
  assignedTo?: string;
  search?: string;
  page: number;
  limit: number;
};

export type ListContactsResult = {
  data: ContactRow[];
  total: number;
  page: number;
  limit: number;
};

function buildWhere(params: ListContactsParams): SQL | undefined {
  const conditions: SQL[] = [];
  if (params.status) conditions.push(eq(contacts.status, params.status));
  if (params.stage) conditions.push(eq(contacts.pipelineStage, params.stage));
  if (params.assignedTo) conditions.push(eq(contacts.assignedTo, params.assignedTo));
  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    const searchCond = or(
      ilike(contacts.firstName, term),
      ilike(contacts.lastName, term),
      ilike(contacts.phone, term),
      ilike(contacts.email, term),
    );
    if (searchCond) conditions.push(searchCond);
  }
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

export async function listContacts(params: ListContactsParams): Promise<ListContactsResult> {
  const where = buildWhere(params);
  const offset = (params.page - 1) * params.limit;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.updatedAt))
      .limit(params.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(where),
  ]);

  return {
    data: rows,
    total: totalRow[0]?.count ?? 0,
    page: params.page,
    limit: params.limit,
  };
}

export async function getContact(id: string): Promise<ContactRow | null> {
  const row = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  return row ?? null;
}

export async function createContact(input: NewContactRow): Promise<ContactRow> {
  const [row] = await db.insert(contacts).values(input).returning();
  if (!row) throw new Error('Contact insert returned no row');
  return row;
}

export type UpdateContactPatch = Partial<Omit<NewContactRow, 'id' | 'createdAt'>>;

export async function updateContact(
  id: string,
  patch: UpdateContactPatch,
  actorUserId: string | null,
): Promise<ContactRow | null> {
  const existing = await getContact(id);
  if (!existing) return null;

  const next = { ...patch, updatedAt: new Date() };
  const [updated] = await db.update(contacts).set(next).where(eq(contacts.id, id)).returning();
  if (!updated) return null;

  if (
    patch.pipelineStage !== undefined &&
    patch.pipelineStage !== existing.pipelineStage
  ) {
    await db.insert(activities).values({
      contactId: id,
      userId: actorUserId,
      type: 'stage_change',
      body: `${existing.pipelineStage ?? 'none'} → ${patch.pipelineStage ?? 'none'}`,
    });
  }

  return updated;
}

export async function softDeleteContact(id: string): Promise<ContactRow | null> {
  const [updated] = await db
    .update(contacts)
    .set({ status: 'lost', updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();
  return updated ?? null;
}
