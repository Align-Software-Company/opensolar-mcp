import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../../src/cli/run.js';
import { ConfigError, parseFlags, resolveHttpBind } from '../../src/lib/config.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CLI flags', () => {
  it('parses help, http bind, and check flags', () => {
    expect(parseFlags(['--help'])).toMatchObject({ help: true });
    expect(parseFlags(['--http', '--host', '0.0.0.0', '--port', '8080', '--path', '/mcp'])).toEqual(
      expect.objectContaining({
        http: true,
        host: '0.0.0.0',
        port: 8080,
        path: '/mcp',
      }),
    );
    expect(parseFlags(['--check', '--no-probe'])).toMatchObject({ check: true, probe: false });
  });

  it('rejects unknown arguments', () => {
    expect(() => parseFlags(['--not-a-flag'])).toThrow(ConfigError);
  });

  it('requires allowed hosts when binding a wildcard HTTP address', () => {
    expect(() => resolveHttpBind(parseFlags(['--http', '--host', '0.0.0.0']))).toThrow(
      /MCP_HTTP_ALLOWED_HOSTS/,
    );
  });
});

describe('CLI commands', () => {
  it('prints help to stdout', async () => {
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--help']);
    write.mockRestore();
    expect(chunks.join('')).toContain('Usage: opensolar-mcp');
  });

  it('lists the default tool surface without credentials', async () => {
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    expect(chunks.join('').trim().split('\n').sort()).toEqual([
      'get_contact',
      'get_event',
      'get_org',
      'get_project',
      'list_contacts',
      'list_projects',
    ]);
  });

  it('filters --list-tools by OPENSOLAR_TOOLSETS', async () => {
    vi.stubEnv('OPENSOLAR_TOOLSETS', 'org');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    expect(chunks.join('').trim()).toBe('get_org');
  });

  it('fails --check when the API token is missing', async () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', '');
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    await expect(runCli(['--check', '--no-probe'])).rejects.toBeInstanceOf(ConfigError);
  });

  it('accepts --check --no-probe when credentials are present', async () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '42');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--check', '--no-probe']);
    write.mockRestore();
    expect(chunks.join('')).toContain('configuration ok');
  });

  it('exits 1 from the process when --check lacks credentials', async () => {
    const { spawn } = await import('node:child_process');
    const { createRequire } = await import('node:module');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { getDefaultEnvironment } = await import('@modelcontextprotocol/client/stdio');

    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
    const child = spawn(process.execPath, [tsxCli, 'src/index.ts', '--check', '--no-probe'], {
      cwd: repoRoot,
      env: { ...getDefaultEnvironment(), OPENSOLAR_ORG_ID: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const code = await new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (exitCode) => resolve(exitCode ?? 1));
    });
    expect(code).toBe(1);
  });
});
