import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = [
    { email: 'andreas@example.com', name: 'Andreas' },
    { email: 'support@oderland.se', name: 'Oderland Support' },
    { email: 'info@uxmail.io', name: 'UxMail Info' },
  ];

  await prisma.contact.deleteMany({
    where: {
      email: { in: contacts.map((contact) => contact.email) },
    },
  });

  await prisma.contact.createMany({
    data: contacts,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
