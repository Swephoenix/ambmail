import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_KEY_FILE = '.uxmail.key';
const DEFAULT_SECRETS_FILE = '.uxmail.secrets';
const ADMIN_PLACEHOLDER = 'replace-with-a-strong-password';
const BASIC_AUTH_PLACEHOLDER = 'replace-with-a-strong-password';
const ENCRYPTION_KEY_PLACEHOLDER = 'replace-with-a-long-random-string-at-least-32-chars';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin';

function randomHex(bytes: number) {
  return crypto.randomBytes(bytes).toString('hex');
}

function readEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return { lines: [] as string[], content: '' };
  const content = fs.readFileSync(filePath, 'utf8');
  return { lines: content.split(/\r?\n/), content };
}

function writeEnv(filePath: string, lines: string[]) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function setEnvValue(lines: string[], key: string, value: string, replaceIfValue?: string) {
  const prefix = `${key}=`;
  let found = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith(prefix)) return line;
    found = true;
    if (replaceIfValue) {
      const current = line.slice(prefix.length).replace(/^\"|\"$/g, '');
      if (current && current !== replaceIfValue) return line;
    }
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

function ensureKeyFile(envPath: string, lines: string[]) {
  const keyFileLine = lines.find((line) => line.startsWith('ENCRYPTION_KEY_FILE='));
  const keyFile = keyFileLine
    ? keyFileLine.split('=')[1].replace(/^\"|\"$/g, '')
    : DEFAULT_KEY_FILE;
  const keyFilePath = path.isAbsolute(keyFile) ? keyFile : path.join(process.cwd(), keyFile);

  if (!fs.existsSync(keyFilePath)) {
    const key = randomHex(32);
    fs.writeFileSync(keyFilePath, `${key}\n`, { mode: 0o600 });
    console.log(`[bootstrap] Created encryption key file at ${keyFilePath}`);
  }

  return setEnvValue(lines, 'ENCRYPTION_KEY_FILE', keyFile);
}

function writeSecretsFile(secrets: Record<string, string>) {
  const filePath = path.join(process.cwd(), DEFAULT_SECRETS_FILE);
  if (fs.existsSync(filePath)) return;
  const content = Object.entries(secrets)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');
  fs.writeFileSync(filePath, `${content}\n`, { mode: 0o600 });
  console.log(`[bootstrap] Wrote secrets to ${filePath}`);
}

function ensureAdminPassword(lines: string[], secrets: Record<string, string>) {
  const current = getEnvValue(lines, 'ADMIN_PASSWORD');
  if (current && current !== ADMIN_PLACEHOLDER) return lines;

  const next = setEnvValue(lines, 'ADMIN_PASSWORD', DEFAULT_ADMIN_PASSWORD);
  secrets.ADMIN_PASSWORD = DEFAULT_ADMIN_PASSWORD;
  console.log('[bootstrap] Ensured ADMIN_PASSWORD in .env');
  return next;
}

function ensureAdminUsername(lines: string[], secrets: Record<string, string>) {
  const current = getEnvValue(lines, 'ADMIN_USERNAME');
  if (current) return lines;
  const next = setEnvValue(lines, 'ADMIN_USERNAME', DEFAULT_ADMIN_USERNAME);
  secrets.ADMIN_USERNAME = DEFAULT_ADMIN_USERNAME;
  console.log('[bootstrap] Ensured ADMIN_USERNAME in .env');
  return next;
}

function ensureBasicAuthPassword(lines: string[], secrets: Record<string, string>) {
  const value = randomHex(16);
  const next = setEnvValue(lines, 'BASIC_AUTH_PASSWORD', value, BASIC_AUTH_PLACEHOLDER);
  if (next !== lines) {
    secrets.BASIC_AUTH_PASSWORD = value;
    console.log('[bootstrap] Ensured BASIC_AUTH_PASSWORD in .env');
  }
  return next;
}

function ensureEncryptionKey(lines: string[], secrets: Record<string, string>) {
  const value = randomHex(32);
  const next = setEnvValue(lines, 'ENCRYPTION_KEY', value, ENCRYPTION_KEY_PLACEHOLDER);
  if (next !== lines) {
    secrets.ENCRYPTION_KEY = value;
    console.log('[bootstrap] Ensured ENCRYPTION_KEY in .env');
  }
  return next;
}

function main() {
  const envPath = path.join(process.cwd(), '.env');
  const { lines } = readEnv(envPath);
  if (lines.length === 0) {
    console.log('[bootstrap] No .env found, skipping secret bootstrap.');
    return;
  }

  const secrets: Record<string, string> = {};
  const adminUsername = getEnvValue(lines, 'ADMIN_USERNAME');
  const basicAuthUser = getEnvValue(lines, 'BASIC_AUTH_USER');

  if (adminUsername) {
    secrets.ADMIN_USERNAME = adminUsername;
  }
  if (basicAuthUser) {
    secrets.BASIC_AUTH_USER = basicAuthUser;
  }
  let nextLines = lines.slice();
  nextLines = ensureKeyFile(envPath, nextLines);
  nextLines = ensureEncryptionKey(nextLines, secrets);
  nextLines = ensureAdminUsername(nextLines, secrets);
  nextLines = ensureAdminPassword(nextLines, secrets);
  nextLines = ensureBasicAuthPassword(nextLines, secrets);

  if (nextLines.join('\n') !== lines.join('\n')) {
    writeEnv(envPath, nextLines);
  }

  if (Object.keys(secrets).length > 0) {
    writeSecretsFile(secrets);
  }
}

main();
