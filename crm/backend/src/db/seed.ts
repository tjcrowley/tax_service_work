import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db, queryClient } from './index.js';
import { users, contacts } from './schema/index.js';
import type { NewContactRow } from './schema/contacts.js';

const ADMIN = {
  email: 'admin@example.com',
  name: 'Katie Admin',
  password: 'admin123',
  role: 'admin' as const,
};

const SEED_CONTACTS: Array<Omit<NewContactRow, 'id' | 'createdAt' | 'updatedAt' | 'assignedTo'>> = [
  {
    firstName: 'Maria',
    lastName: 'Hernandez',
    email: 'maria.hernandez@example.com',
    phone: '+15125550101',
    taxDebtAmount: '47500.00',
    taxYears: ['2020', '2021', '2022'],
    irsIssueType: 'wage_garnishment',
    status: 'lead',
    pipelineStage: 'new',
    source: 'website',
    city: 'Austin',
    state: 'TX',
    zip: '78704',
  },
  {
    firstName: 'James',
    lastName: 'Patterson',
    email: 'jpatterson@example.com',
    phone: '+14045550182',
    taxDebtAmount: '128300.00',
    taxYears: ['2018', '2019', '2020'],
    irsIssueType: 'bank_levy',
    status: 'prospect',
    pipelineStage: 'contacted',
    source: 'purchased_list',
    sourceDetail: 'TaxLeadsPro Q1 2026',
    city: 'Atlanta',
    state: 'GA',
    zip: '30303',
  },
  {
    firstName: 'Lakeisha',
    lastName: 'Brown',
    email: 'lbrown@example.com',
    phone: '+13105550144',
    taxDebtAmount: '22800.00',
    taxYears: ['2022'],
    irsIssueType: 'back_taxes',
    status: 'prospect',
    pipelineStage: 'qualified',
    source: 'referral',
    sourceDetail: 'Maria Hernandez',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90019',
  },
  {
    firstName: 'David',
    lastName: 'Chen',
    email: 'dchen@example.com',
    phone: '+12065550167',
    taxDebtAmount: '83100.00',
    taxYears: ['2019', '2020', '2021', '2022'],
    irsIssueType: 'unfiled_returns',
    status: 'client',
    pipelineStage: 'proposal',
    source: 'social',
    sourceDetail: 'Facebook Ad — Q4 2025',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
  },
  {
    firstName: 'Rebecca',
    lastName: 'Goldstein',
    email: 'rgoldstein@example.com',
    phone: '+12125550189',
    taxDebtAmount: '215750.00',
    taxYears: ['2017', '2018', '2019', '2020', '2021'],
    irsIssueType: 'lien',
    status: 'client',
    pipelineStage: 'negotiating',
    source: 'website',
    city: 'New York',
    state: 'NY',
    zip: '10025',
  },
  {
    firstName: 'Marcus',
    lastName: 'Williams',
    email: null,
    phone: '+16025550113',
    taxDebtAmount: '14200.00',
    taxYears: ['2022'],
    irsIssueType: 'back_taxes',
    status: 'lead',
    pipelineStage: 'new',
    source: 'purchased_list',
    sourceDetail: 'TaxLeadsPro Q1 2026',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85003',
  },
  {
    firstName: 'Jennifer',
    lastName: 'O’Brien',
    email: 'jobrien@example.com',
    phone: '+16175550178',
    taxDebtAmount: '67400.00',
    taxYears: ['2019', '2020', '2021'],
    irsIssueType: 'wage_garnishment',
    status: 'client',
    pipelineStage: 'resolution',
    source: 'referral',
    sourceDetail: 'CPA partnership — Smith & Co',
    city: 'Boston',
    state: 'MA',
    zip: '02116',
  },
  {
    firstName: 'Roberto',
    lastName: 'Mendoza',
    email: 'rmendoza@example.com',
    phone: '+13055550155',
    taxDebtAmount: '38900.00',
    taxYears: ['2020', '2021'],
    irsIssueType: 'back_taxes',
    status: 'prospect',
    pipelineStage: 'contacted',
    source: 'website',
    city: 'Miami',
    state: 'FL',
    zip: '33130',
  },
  {
    firstName: 'Ashley',
    lastName: 'Nguyen',
    email: 'anguyen@example.com',
    phone: '+17145550196',
    taxDebtAmount: '9750.00',
    taxYears: ['2022'],
    irsIssueType: 'other',
    status: 'resolved',
    pipelineStage: 'closed',
    source: 'social',
    sourceDetail: 'Instagram Reel',
    city: 'Anaheim',
    state: 'CA',
    zip: '92805',
  },
  {
    firstName: 'Thomas',
    lastName: 'Wright',
    email: 'twright@example.com',
    phone: '+13125550138',
    taxDebtAmount: '52600.00',
    taxYears: ['2019', '2020'],
    irsIssueType: 'bank_levy',
    status: 'lost',
    pipelineStage: 'closed',
    source: 'purchased_list',
    sourceDetail: 'TaxLeadsPro Q4 2025',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    doNotCall: true,
  },
];

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(ADMIN.password, 10);

  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN.email,
      name: ADMIN.name,
      role: ADMIN.role,
      passwordHash,
      isActive: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (admin) {
    console.log(`  ✓ admin user: ${admin.email}`);
  } else {
    console.log(`  · admin user already exists (${ADMIN.email})`);
  }

  const adminRow = admin ?? (await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, ADMIN.email),
  }));
  if (!adminRow) throw new Error('Failed to locate admin user after upsert');

  const rows = SEED_CONTACTS.map((c) => ({ ...c, assignedTo: adminRow.id }));
  const inserted = await db
    .insert(contacts)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: contacts.id });

  console.log(`  ✓ ${inserted.length} contacts inserted`);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end({ timeout: 5 });
  });
