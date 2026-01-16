import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

const ANIMALS = [
  'fox',
  'otter',
  'lynx',
  'panda',
  'eagle',
  'tiger',
  'orca',
  'koala',
  'yak',
  'marten',
  'badger',
  'falcon',
  'rabbit',
  'raven',
  'moose',
  'heron',
  'wolf',
  'bison',
  'lemur',
  'squid',
  'gecko',
  'hare',
  'lizard',
  'owl',
  'seal',
  'stork',
  'whale',
  'zebra',
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUsername() {
  const animal = ANIMALS[randomInt(0, ANIMALS.length - 1)];
  const suffix = randomInt(1000, 9999);
  return `${animal}-${suffix}`;
}

function randomPassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export async function rotateAdminCredentialsIfNeeded(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'ADMIN' || user.adminCredentialsShownAt) {
    return null;
  }

  let username = randomUsername();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken || taken.id === user.id) break;
    username = randomUsername();
  }

  const password = randomPassword(16);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      passwordHash: hashPassword(password),
      adminCredentialsShownAt: new Date(),
    },
  });

  return {
    adminUsername: username,
    adminPassword: password,
  };
}
