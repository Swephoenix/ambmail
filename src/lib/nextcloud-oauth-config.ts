import fs from 'fs/promises';
import path from 'path';

export type RuntimeOAuthConfig = {
  clientId: string;
  clientSecret: string;
  updatedAt: string;
};

const DEFAULT_FILE = '.nextcloud-oauth.json';

function getConfigPath() {
  const configured = process.env.NC_OAUTH_RUNTIME_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), DEFAULT_FILE);
}

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function readRuntimeOAuthConfig(): Promise<RuntimeOAuthConfig | null> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<RuntimeOAuthConfig>;
    const clientId = normalize(parsed.clientId);
    const clientSecret = normalize(parsed.clientSecret);
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      updatedAt: normalize(parsed.updatedAt) || new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function writeRuntimeOAuthConfig(clientId: string, clientSecret: string) {
  const payload: RuntimeOAuthConfig = {
    clientId: normalize(clientId),
    clientSecret: normalize(clientSecret),
    updatedAt: new Date().toISOString(),
  };
  if (!payload.clientId || !payload.clientSecret) {
    throw new Error('clientId and clientSecret are required');
  }
  await fs.writeFile(getConfigPath(), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
