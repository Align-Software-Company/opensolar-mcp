import { z } from 'zod';
import {
  isToolsetName,
  TOOLSET_NAMES,
  type ToolFilters,
  type ToolsetName,
} from '../tools/index.js';
import { ConfigError } from './config-error.js';

export { ConfigError };

export const BaseUrlSchema = z
  .string()
  .url()
  .default('https://api.opensolar.com/api/')
  .transform((value) => (value.endsWith('/') ? value : `${value}/`));

const CredentialsSchema = z.object({
  OPENSOLAR_API_TOKEN: z.string().min(1, 'OPENSOLAR_API_TOKEN is required'),
  OPENSOLAR_ORG_ID: z.coerce.number().int().positive('OPENSOLAR_ORG_ID must be a positive integer'),
  BASE_URL: BaseUrlSchema,
});

export type Config = z.infer<typeof CredentialsSchema>;

export type AccessPlan = 'api_access' | 'raw_data';

export type ParsedFlags = {
  help: boolean;
  check: boolean;
  probe: boolean;
  listTools: boolean;
  http: boolean;
  host: string | undefined;
  port: number | undefined;
  path: string | undefined;
};

export type HttpBind = {
  host: string;
  port: number;
  path: string;
  allowedHosts: string[] | undefined;
};

const DEFAULT_HTTP_HOST = '127.0.0.1';
const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_HTTP_PATH = '/mcp';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::']);

function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

export function loadConfig(): Config {
  const parsed = CredentialsSchema.safeParse({
    OPENSOLAR_API_TOKEN: process.env.OPENSOLAR_API_TOKEN,
    OPENSOLAR_ORG_ID: process.env.OPENSOLAR_ORG_ID,
    BASE_URL: process.env.OPENSOLAR_BASE_URL ?? undefined,
  });

  if (!parsed.success) {
    throw new ConfigError(
      `Invalid environment configuration:\n${formatZodIssues(parsed.error)}\n\nSee .env.example for required variables.`,
    );
  }

  return parsed.data;
}

export function loadOrgId(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = z.coerce
    .number()
    .int()
    .positive('OPENSOLAR_ORG_ID must be a positive integer')
    .safeParse(env.OPENSOLAR_ORG_ID);
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid environment configuration:\n${formatZodIssues(parsed.error)}\n\nSee .env.example for required variables.`,
    );
  }
  return parsed.data;
}

export function loadBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = BaseUrlSchema.safeParse(env.OPENSOLAR_BASE_URL ?? undefined);
  if (!parsed.success) {
    throw new ConfigError(`Invalid OPENSOLAR_BASE_URL:\n${formatZodIssues(parsed.error)}`);
  }
  return parsed.data;
}

function parseTruthy(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function loadToolFilters(env: NodeJS.ProcessEnv = process.env): ToolFilters {
  return {
    toolsets: parseToolsets(env.OPENSOLAR_TOOLSETS),
    readOnly: parseTruthy(env.OPENSOLAR_READ_ONLY),
    plan: parsePlan(env.OPENSOLAR_PLAN),
  };
}

function parseToolsets(raw: string | undefined): ToolsetName[] {
  if (raw === undefined || raw.trim() === '') {
    return [...TOOLSET_NAMES];
  }
  const parts = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '');
  const unknown = parts.filter((part) => !isToolsetName(part));
  if (unknown.length > 0) {
    throw new ConfigError(
      `Unknown toolset(s): ${unknown.join(', ')}. Valid toolsets: ${TOOLSET_NAMES.join(', ')}.`,
    );
  }
  return parts.filter(isToolsetName);
}

function parsePlan(raw: string | undefined): AccessPlan | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'api_access' || value === 'raw_data') {
    return value;
  }
  throw new ConfigError(`Unknown OPENSOLAR_PLAN: ${raw}. Valid values: api_access, raw_data.`);
}

function parseAllowedHosts(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const hosts = raw
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '');
  return hosts.length === 0 ? undefined : hosts;
}

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith('-')) {
    throw new ConfigError(`${flag} requires a value. Try --help.`);
  }
  return value;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`Invalid port: ${raw}. Expected an integer 1–65535.`);
  }
  return port;
}

export function parseFlags(argv: string[]): ParsedFlags {
  const flags: ParsedFlags = {
    help: false,
    check: false,
    probe: true,
    listTools: false,
    http: false,
    host: undefined,
    port: undefined,
    path: undefined,
  };
  let sawProbeFlag = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      break;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg === '--check') {
      flags.check = true;
      continue;
    }
    if (arg === '--list-tools') {
      flags.listTools = true;
      continue;
    }
    if (arg === '--http') {
      flags.http = true;
      continue;
    }
    if (arg === '--probe') {
      flags.probe = true;
      sawProbeFlag = true;
      continue;
    }
    if (arg === '--no-probe') {
      flags.probe = false;
      sawProbeFlag = true;
      continue;
    }
    if (arg === '--host') {
      index += 1;
      flags.host = takeValue(argv, index, '--host');
      continue;
    }
    if (arg.startsWith('--host=')) {
      flags.host = arg.slice('--host='.length);
      continue;
    }
    if (arg === '--port') {
      index += 1;
      flags.port = parsePort(takeValue(argv, index, '--port'));
      continue;
    }
    if (arg.startsWith('--port=')) {
      flags.port = parsePort(arg.slice('--port='.length));
      continue;
    }
    if (arg === '--path') {
      index += 1;
      flags.path = takeValue(argv, index, '--path');
      continue;
    }
    if (arg.startsWith('--path=')) {
      flags.path = arg.slice('--path='.length);
      continue;
    }
    throw new ConfigError(`Unknown argument: ${arg}. Try --help.`);
  }

  if (sawProbeFlag && !flags.check) {
    throw new ConfigError('--probe and --no-probe require --check.');
  }

  return flags;
}

function normalizeHttpPath(path: string): string {
  const trimmed = path.trim();
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash === '/' || withSlash === '/health' || withSlash === '/ready') {
    throw new ConfigError(
      `HTTP MCP path cannot be '${withSlash}' because /health and /ready are reserved. Use --path /mcp.`,
    );
  }
  if (!/^\/[A-Za-z0-9/_-]+$/.test(withSlash)) {
    throw new ConfigError(`Invalid HTTP MCP path: ${path}`);
  }
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

export function resolveHttpBind(
  flags: ParsedFlags,
  env: NodeJS.ProcessEnv = process.env,
): HttpBind {
  const host = flags.host ?? env.MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST;
  const portRaw =
    flags.port ?? (env.MCP_HTTP_PORT !== undefined ? Number(env.MCP_HTTP_PORT) : DEFAULT_HTTP_PORT);
  if (!Number.isInteger(portRaw) || portRaw < 1 || portRaw > 65535) {
    throw new ConfigError(`Invalid HTTP port: ${portRaw}. Expected an integer 1–65535.`);
  }
  const path = normalizeHttpPath(flags.path ?? env.MCP_HTTP_PATH ?? DEFAULT_HTTP_PATH);
  const allowedHosts = parseAllowedHosts(env.MCP_HTTP_ALLOWED_HOSTS);

  if (WILDCARD_HOSTS.has(host) && (allowedHosts === undefined || allowedHosts.length === 0)) {
    throw new ConfigError(
      `Binding HTTP to ${host} requires MCP_HTTP_ALLOWED_HOSTS so DNS-rebinding protection can allow your public hostname.`,
    );
  }

  return {
    host,
    port: portRaw,
    path,
    allowedHosts: LOCAL_HOSTS.has(host)
      ? undefined
      : (allowedHosts ?? (WILDCARD_HOSTS.has(host) ? undefined : [host])),
  };
}
