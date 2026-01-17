const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const contacts = [
    { email: 'andreas@example.com', name: 'Andreas' },
    { email: 'support@oderland.se', name: 'Oderland Support' },
    { email: 'info@uxmail.io', name: 'UxMail Info' },
  ];

  for (const contact of contacts) {
    await prisma.contact.upsert({
      where: { email: contact.email },
      update: { name: contact.name },
      create: contact,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
