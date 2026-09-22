import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const localEnvFiles = ['.env.local', 'dev-docs/private/.env.local'] as const;

function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function loadLocalEnv(): void {
  for (const relativePath of localEnvFiles) {
    const absolutePath = resolve(process.cwd(), relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const parsed = parseEnvFile(readFileSync(absolutePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

export function hasLiveOpenSolarCredentials(): boolean {
  const token = process.env.OPENSOLAR_API_TOKEN;
  const orgId = process.env.OPENSOLAR_ORG_ID;
  return Boolean(token && orgId);
}
