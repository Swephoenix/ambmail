import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MIN_KEY_LENGTH = 32;
const DEFAULT_KEY_FILE = '.uxmail.key';

function getKeyFilePath(): string {
  const envPath = process.env.ENCRYPTION_KEY_FILE;
  if (envPath) return envPath;
  return path.join(process.cwd(), DEFAULT_KEY_FILE);
}

function readOrCreateKeyFile(filePath: string): string {
  if (fs.existsSync(filePath)) {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (value.length < MIN_KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY_FILE must be at least ${MIN_KEY_LENGTH} characters`);
    }
    return value;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(filePath, `${generated}\n`, { mode: 0o600 });
  return generated;
}

function getEncryptionKey(): string {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length < MIN_KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters`);
    }
    return envKey;
  }

  const keyFile = getKeyFilePath();
  return readOrCreateKeyFile(keyFile);
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}
