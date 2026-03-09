#!/usr/bin/env ts-node
/**
 * Seed script to create global address book groups
 * Run with: npx ts-node scripts/seed-address-book-groups.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_GROUPS = [
  {
    name: 'Alla aktiva',
    description: 'Alla aktiva kontakter',
  },
  {
    name: 'FB-sidor',
    description: 'Facebook-sidor',
  },
];

async function main() {
  console.log('Seeding global address book groups...');

  for (const group of GLOBAL_GROUPS) {
    const existing = await prisma.contactGroup.findFirst({
      where: {
        userId: null,
        name: group.name,
      },
    });

    if (!existing) {
      await prisma.contactGroup.create({
        data: {
          name: group.name,
          description: group.description,
          userId: null,
          isSystem: true,
        },
      });
      console.log(`✓ Created global group: ${group.name}`);
    } else {
      console.log(`- Group already exists: ${group.name}`);
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
