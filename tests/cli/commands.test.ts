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
    expect(chunks.join('').trim().split('\n')).toEqual([
      'list_projects',
      'search_projects',
      'get_project',
      'create_project',
      'update_project',
      'update_project_stage',
      'update_project_usage',
      'delete_project',
      'get_org',
      'list_roles',
      'get_role',
      'list_contacts',
      'search_contacts',
      'get_contact',
      'create_contact',
      'update_contact',
      'delete_contact',
      'get_event',
      'list_event_types',
      'list_project_systems',
      'get_system',
      'get_system_details',
      'get_system_image',
      'list_modules',
      'get_module',
      'delete_module_activation',
      'list_inverters',
      'get_inverter',
      'delete_inverter_activation',
      'list_batteries',
      'get_battery',
      'delete_battery_activation',
      'list_other_components',
      'get_other_component',
      'delete_other_component_activation',
      'list_workflows',
      'get_workflow',
      'create_workflow',
      'delete_workflow',
      'list_payment_options',
      'get_payment_option',
      'delete_payment_option',
      'list_pricing_schemes',
      'get_pricing_scheme',
      'delete_pricing_scheme',
      'list_costings',
      'get_costing',
      'delete_costing',
      'list_roof_types',
      'list_file_tags',
      'list_private_files',
      'get_private_file',
      'create_private_file',
      'update_private_file',
      'delete_private_file',
      'generate_project_document',
      'list_webhooks',
      'create_webhook',
      'update_webhook',
      'list_webhook_logs',
      'list_webhook_queue',
      'list_connected_orgs',
      'list_connection_requests',
      'create_connection_request',
      'accept_connection_request',
      'update_connection',
      'delete_connection',
      'share_project',
      'share_entities',
      'create_permission_role',
      'get_proposal_data',
      'get_project_design',
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
    expect(chunks.join('').trim().split('\n')).toEqual(['get_org', 'list_roles', 'get_role']);
  });

  it('omits registered writes when OPENSOLAR_READ_ONLY=1', async () => {
    vi.stubEnv('OPENSOLAR_READ_ONLY', '1');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    const names = chunks.join('').trim().split('\n');
    expect(names).toContain('list_projects');
    expect(names).toContain('get_contact');
    for (const name of [
      'create_project',
      'update_project',
      'update_project_stage',
      'update_project_usage',
      'delete_project',
      'create_contact',
      'update_contact',
      'delete_contact',
      'delete_module_activation',
      'delete_inverter_activation',
      'delete_battery_activation',
      'delete_other_component_activation',
      'delete_pricing_scheme',
      'create_workflow',
      'delete_workflow',
      'delete_payment_option',
      'delete_costing',
      'create_private_file',
      'update_private_file',
      'delete_private_file',
      'get_system_image',
      'generate_project_document',
      'create_webhook',
      'update_webhook',
      'create_connection_request',
      'accept_connection_request',
      'update_connection',
      'delete_connection',
      'share_project',
      'share_entities',
      'create_permission_role',
    ]) {
      expect(names).not.toContain(name);
    }
  });

  it('omits raw data tools when OPENSOLAR_PLAN=api_access', async () => {
    vi.stubEnv('OPENSOLAR_PLAN', 'api_access');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    const names = chunks.join('').trim().split('\n');
    expect(names).toContain('list_projects');
    expect(names).not.toContain('get_proposal_data');
    expect(names).not.toContain('get_project_design');
  });

  it('lists workflow tools when that toolset is selected', async () => {
    vi.stubEnv('OPENSOLAR_TOOLSETS', 'workflow');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    expect(chunks.join('').trim().split('\n')).toEqual([
      'list_workflows',
      'get_workflow',
      'create_workflow',
      'delete_workflow',
    ]);
  });

  it('lists component and payment toolsets', async () => {
    vi.stubEnv('OPENSOLAR_TOOLSETS', 'components');
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    await runCli(['--list-tools']);
    write.mockRestore();
    expect(chunks.join('').trim().split('\n')).toEqual([
      'list_modules',
      'get_module',
      'delete_module_activation',
      'list_inverters',
      'get_inverter',
      'delete_inverter_activation',
      'list_batteries',
      'get_battery',
      'delete_battery_activation',
      'list_other_components',
      'get_other_component',
      'delete_other_component_activation',
    ]);

    vi.stubEnv('OPENSOLAR_TOOLSETS', 'payment');
    const paymentChunks: string[] = [];
    const paymentWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      paymentChunks.push(String(chunk));
      return true;
    });
    await runCli(['--list-tools']);
    paymentWrite.mockRestore();
    expect(paymentChunks.join('').trim().split('\n')).toEqual([
      'list_payment_options',
      'get_payment_option',
      'delete_payment_option',
    ]);
  });

  it('rejects an unknown toolset', async () => {
    vi.stubEnv('OPENSOLAR_TOOLSETS', 'not-a-toolset');
    await expect(runCli(['--list-tools'])).rejects.toBeInstanceOf(ConfigError);
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
