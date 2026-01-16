import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_NAME = 'Admin';
const DEFAULT_SECRETS_FILE = '.uxmail.secrets';
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
  'zebra'
];

function randomHex(bytes: number) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAnimalUsername() {
  const animal = ANIMALS[randomInt(0, ANIMALS.length - 1)];
  const suffix = randomInt(1000, 9999);
  return `${animal}-${suffix}`;
}

function readEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return { lines: [] as string[], content: '' };
  const content = fs.readFileSync(filePath, 'utf8');
  return { lines: content.split(/\r?\n/), content };
}

function writeEnv(filePath: string, lines: string[]) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function setEnvValue(lines: string[], key: string, value: string) {
  const prefix = `${key}=`;
  let found = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith(prefix)) return line;
    found = true;
    return `${key}="${value}"`;
  });

  if (!found) {
    nextLines.push(`${key}="${value}"`);
  }
  return nextLines;
}

function getEnvValue(lines: string[], key: string) {
  const prefix = `${key}=`;
  const line = lines.find((item) => item.startsWith(prefix));
  if (!line) return '';
  return line.slice(prefix.length).replace(/^\"|\"$/g, '');
}

function upsertSecrets(secrets: Record<string, string>) {
  const filePath = path.join(process.cwd(), DEFAULT_SECRETS_FILE);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/) : [];
  let lines = existing.filter((line) => line.trim().length > 0);

  for (const [key, value] of Object.entries(secrets)) {
    lines = setEnvValue(lines, key, value);
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, { mode: 0o600 });
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  const { lines } = readEnv(envPath);
  if (lines.length === 0) {
    throw new Error('Missing .env. Create it before rotating admin credentials.');
  }

  const existingUsername = getEnvValue(lines, 'ADMIN_USERNAME') || DEFAULT_ADMIN_USERNAME;
  const name = getEnvValue(lines, 'ADMIN_NAME') || DEFAULT_ADMIN_NAME;
  const password = randomHex(16);

  const prisma = new PrismaClient();
  let username = randomAnimalUsername();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (!taken) break;
    username = randomAnimalUsername();
  }

  let nextLines = lines.slice();
  nextLines = setEnvValue(nextLines, 'ADMIN_USERNAME', username);
  nextLines = setEnvValue(nextLines, 'ADMIN_PASSWORD', password);
  if (nextLines.join('\n') !== lines.join('\n')) {
    writeEnv(envPath, nextLines);
  }

  upsertSecrets({
    ADMIN_USERNAME: username,
    ADMIN_PASSWORD: password,
  });

  const existing = await prisma.user.findUnique({ where: { username: existingUsername } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        passwordHash: hashPassword(password),
        role: 'ADMIN',
      },
    });
  } else {
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        name,
        role: 'ADMIN',
      },
    });
  }

  await prisma.$disconnect();

  console.log('[admin-rotate] Admin credentials updated.');
  console.log(`[admin-rotate] ADMIN_USERNAME=${username}`);
  console.log(`[admin-rotate] ADMIN_PASSWORD=${password}`);
  console.log(`[admin-rotate] Stored in ${DEFAULT_SECRETS_FILE}`);
}

main().catch((error) => {
  console.error('[admin-rotate] Failed to rotate admin credentials:', error);
  process.exitCode = 1;
});
