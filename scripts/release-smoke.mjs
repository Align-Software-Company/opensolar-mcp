import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_TOKEN = 'test-token';

const AGENT_TOOLS = [
  'list_projects',
  'search_projects',
  'get_project',
  'get_project_snapshot',
  'create_project',
  'update_project',
  'update_project_stage',
  'update_project_usage',
  'get_org',
  'list_roles',
  'list_contacts',
  'search_contacts',
  'get_contact',
  'create_contact',
  'update_contact',
  'compare_project_systems',
  'get_system_details',
  'list_payment_options',
  'list_pricing_schemes',
  'list_costings',
  'list_roof_types',
  'list_file_tags',
  'list_private_files',
  'get_private_file',
  'create_private_file',
  'generate_project_document',
  'list_connected_orgs',
  'preflight_project_share',
  'share_project',
  'share_entities',
  'get_proposal_data',
  'get_project_design',
];

const WEBHOOK_TOOLS = [
  'list_webhooks',
  'create_webhook',
  'update_webhook',
  'list_webhook_logs',
  'list_webhook_queue',
];

const ALLOWED_PACKAGE_ENTRIES = new Set(['package.json', 'README.md', 'LICENSE', 'dist']);
const SECRET_MARKERS = ['OPENSOLAR_API_TOKEN=', 'sk_live_', 'PRIVATE KEY', '.env.local'];
const FERNET_TOKEN = /gAAAA[A-Za-z0-9+/=_-]{20,}/;
const CUSTOMER_MARKERS = ['gconstanza@vanderlayindustries.com'];

function report(line) {
  process.stdout.write(`${line}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function findTarball() {
  const named = process.argv[2];
  if (named) {
    return named.startsWith('/') ? named : join(repoRoot, named);
  }
  const matches = readdirSync(repoRoot).filter((name) => name.endsWith('.tgz'));
  if (matches.length !== 1) {
    fail(`expected one .tgz in ${repoRoot}, found ${matches.length}`);
  }
  return join(repoRoot, matches[0]);
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

function readLocalTokens() {
  const tokens = [];
  for (const relativePath of ['.env.local', 'dev-docs/private/.env.local']) {
    let text = '';
    try {
      text = readFileSync(join(repoRoot, relativePath), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    const match = text.match(/^OPENSOLAR_API_TOKEN=(.*)$/m);
    if (!match) {
      continue;
    }
    let value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length >= 8 && !tokens.includes(value)) {
      tokens.push(value);
    }
  }
  return tokens;
}

function inspectTarball(tarballPath) {
  const extracted = mkdtempSync(join(tmpdir(), 'opensolar-mcp-tarball-'));
  const listing = spawnSync('tar', ['-xzf', tarballPath, '-C', extracted], { encoding: 'utf8' });
  if (listing.status !== 0) {
    fail(`tar extract failed: ${listing.stderr}`);
  }
  const packageRoot = join(extracted, 'package');
  const topLevel = readdirSync(packageRoot).sort();
  const unexpected = topLevel.filter((name) => !ALLOWED_PACKAGE_ENTRIES.has(name));
  if (unexpected.length > 0) {
    fail(`unexpected tarball entries: ${unexpected.join(', ')}`);
  }
  const files = walkFiles(packageRoot);
  const relativePaths = files.map((path) => relative(packageRoot, path));
  const forbiddenSegments = new Set([
    '.env',
    '.env.local',
    '.git',
    'dev-docs',
    'evals',
    'tests',
    'node_modules',
  ]);
  const forbiddenPath = relativePaths.find((path) =>
    path
      .split('/')
      .some((segment) => forbiddenSegments.has(segment) || segment.includes('source-log')),
  );
  if (forbiddenPath) {
    fail(`forbidden path in tarball: ${forbiddenPath}`);
  }
  const localTokens = readLocalTokens();
  let tokenMatch = false;
  let bearerMatch = false;
  let fernetToken = false;
  let fernetPrefix = false;
  const markerHits = [];
  const customerHits = [];
  for (const path of files) {
    const asString = readFileSync(path).toString('utf8');
    const rel = relative(packageRoot, path);
    for (const localToken of localTokens) {
      if (asString.includes(localToken)) {
        tokenMatch = true;
      }
      if (asString.includes(`Bearer ${localToken}`)) {
        bearerMatch = true;
      }
    }
    if (asString.includes('gAAAA')) {
      fernetPrefix = true;
    }
    const withoutRedactionPattern = asString.replaceAll('gAAAA[A-Za-z0-9+/=_-]{20,}', '');
    if (FERNET_TOKEN.test(withoutRedactionPattern)) {
      fernetToken = true;
    }
    for (const marker of SECRET_MARKERS) {
      if (asString.includes(marker)) {
        markerHits.push(`${marker} in ${rel}`);
      }
    }
    for (const marker of CUSTOMER_MARKERS) {
      if (asString.includes(marker)) {
        customerHits.push(rel);
      }
    }
  }
  const outsideReadme = markerHits.filter((hit) => !hit.endsWith(' in README.md'));
  if (
    tokenMatch ||
    bearerMatch ||
    fernetToken ||
    outsideReadme.length > 0 ||
    customerHits.length > 0
  ) {
    fail(
      `secret scan failed token_match=${tokenMatch} bearer_token_match=${bearerMatch} fernet_token=${fernetToken} marker_hits=${outsideReadme.join('; ') || 'none'} customer_hits=${customerHits.join(', ') || 'none'}`,
    );
  }
  const unpackedBytes = files.reduce((sum, path) => sum + statSync(path).size, 0);
  report(`tarball=${tarballPath.split('/').at(-1)}`);
  report(`unpacked_bytes=${unpackedBytes}`);
  report(`top_level=${topLevel.join(',')}`);
  report(`file_count=${files.length}`);
  report('secret_scan=clear');
  report(`local_tokens_searched=${localTokens.length}`);
  report(`token_match=${tokenMatch ? 'yes' : 'no'}`);
  report(`bearer_token_match=${bearerMatch ? 'yes' : 'no'}`);
  report(`fernet_token=${fernetToken ? 'yes' : 'no'}`);
  report(`gAAAA_prefix=${fernetPrefix ? 'redaction_pattern_only' : 'absent'}`);
  report(`doc_marker_mentions=${markerHits.length === 0 ? 'none' : markerHits.join('; ')}`);
  report(`customer_example_hits=${customerHits.length === 0 ? 'none' : customerHits.join(', ')}`);
  report('tarball_files:');
  for (const path of relativePaths.sort()) {
    report(`  ${path}`);
  }
  rmSync(extracted, { recursive: true, force: true });
}

function childEnv(extra) {
  return { ...getDefaultEnvironment(), ...extra };
}

function runBin(bin, args, extraEnv) {
  return spawnSync(bin, args, {
    encoding: 'utf8',
    env: childEnv(extraEnv),
  });
}

function toolNames(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function assertSameNames(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail(`${label} mismatch: ${actual.join(',')}`);
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('could not reserve a port'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function listenMockOrg() {
  const payload = readFileSync(join(repoRoot, 'tests/fixtures/opensolar/org/summary.json'));
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(payload);
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('mock OpenSolar server did not bind'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}/api/`,
        close: () =>
          new Promise((done, failClose) => {
            server.close((error) => {
              if (error) {
                failClose(error);
                return;
              }
              done();
            });
          }),
      });
    });
    server.on('error', reject);
  });
}

async function smokeStdio(distIndex, packageVersion) {
  const mock = await listenMockOrg();
  const stderrChunks = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [distIndex],
    cwd: dirname(distIndex),
    env: childEnv({
      OPENSOLAR_API_TOKEN: FIXTURE_TOKEN,
      OPENSOLAR_ORG_ID: '1',
      OPENSOLAR_BASE_URL: mock.baseUrl,
    }),
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
  });
  const client = new Client({ name: 'release-smoke', version: '0.0.0' });
  try {
    await client.connect(transport);
    const serverVersion = client.getServerVersion();
    if (serverVersion?.version !== packageVersion) {
      fail(`stdio server version ${serverVersion?.version ?? 'missing'} != ${packageVersion}`);
    }
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    assertSameNames(names, AGENT_TOOLS, 'stdio tools/list');
    const result = await client.callTool({ name: 'get_org', arguments: {} });
    const structured = result.structuredContent;
    if (
      typeof structured !== 'object' ||
      structured === null ||
      !('id' in structured) ||
      !('name' in structured) ||
      structured.id !== 1 ||
      structured.name !== 'Example Solar Co'
    ) {
      fail('stdio get_org did not return the fixture org');
    }
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    if (!stderr.includes('opensolar-mcp ready')) {
      fail('stdio logs were not on stderr');
    }
    if (stderr.includes(FIXTURE_TOKEN)) {
      fail('stdio stderr included the fixture token');
    }
    report('stdio_smoke=ok');
    report(`stdio_server_version=${serverVersion.version}`);
    report(`stdio_tool_count=${names.length}`);
  } finally {
    await client.close();
    await mock.close();
  }
}

async function waitForHealth(origin) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Process is still binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(`HTTP server did not become healthy at ${origin}`);
}

async function smokeHttp(distIndex) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const stderrChunks = [];
  const child = spawn(process.execPath, [distIndex, '--http'], {
    env: childEnv({
      OPENSOLAR_ORG_ID: '1',
      OPENSOLAR_API_TOKEN: FIXTURE_TOKEN,
      MCP_HTTP_HOST: '127.0.0.1',
      MCP_HTTP_PORT: String(port),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
  });
  try {
    await waitForHealth(origin);
    const health = await fetch(`${origin}/health`);
    const ready = await fetch(`${origin}/ready`);
    if ((await health.json()).status !== 'ok' || (await ready.json()).status !== 'ready') {
      fail('installed HTTP health or ready payload was not ok');
    }
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));
    const client = new Client({ name: 'release-smoke-http', version: '0.0.0' });
    await client.connect(transport);
    try {
      const listed = await client.listTools();
      assertSameNames(
        listed.tools.map((tool) => tool.name),
        AGENT_TOOLS,
        'http tools/list',
      );
    } finally {
      await client.close();
    }
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    if (!stderr.includes('opensolar-mcp ready') || stderr.includes(FIXTURE_TOKEN)) {
      fail('HTTP logs were not confined to stderr');
    }
    report('http_smoke=ok');
    report(`http_origin=${origin}`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      child.once('exit', () => resolve());
    });
  }
}

async function smokePublicHttpAuth(distIndex) {
  const mock = await listenMockOrg();
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const stderrChunks = [];
  const child = spawn(process.execPath, [distIndex, '--http'], {
    env: childEnv({
      OPENSOLAR_ORG_ID: '1',
      OPENSOLAR_API_TOKEN: 'server-env-token',
      OPENSOLAR_BASE_URL: mock.baseUrl,
      MCP_HTTP_HOST: '0.0.0.0',
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_ALLOWED_HOSTS: '127.0.0.1',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
  });
  try {
    await waitForHealth(origin);

    const anonymousTransport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));
    const anonymousClient = new Client({ name: 'release-smoke-public-anon', version: '0.0.0' });
    let anonymousFailed = false;
    try {
      await anonymousClient.connect(anonymousTransport);
    } catch {
      anonymousFailed = true;
    } finally {
      await anonymousClient.close().catch(() => undefined);
    }
    if (!anonymousFailed) {
      fail('non-loopback HTTP accepted an MCP client without Authorization');
    }

    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${FIXTURE_TOKEN}` } },
    });
    const client = new Client({ name: 'release-smoke-public-auth', version: '0.0.0' });
    await client.connect(transport);
    try {
      const result = await client.callTool({ name: 'get_org', arguments: {} });
      if (
        typeof result.structuredContent !== 'object' ||
        result.structuredContent === null ||
        result.structuredContent.id !== 1
      ) {
        fail('authenticated non-loopback HTTP did not reach the mock org');
      }
    } finally {
      await client.close();
    }

    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    if (!stderr.includes('OPENSOLAR_API_TOKEN is ignored for non-loopback HTTP')) {
      fail('non-loopback HTTP did not warn that the environment token is ignored');
    }
    if (stderr.includes('server-env-token') || stderr.includes(FIXTURE_TOKEN)) {
      fail('public HTTP stderr included a token');
    }
    report('http_public_requires_request_bearer=ok');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      child.once('exit', () => resolve());
    });
    await mock.close();
  }
}

function smokeFailClosed(distIndex) {
  const result = spawnSync(process.execPath, [distIndex, '--http'], {
    encoding: 'utf8',
    env: childEnv({
      OPENSOLAR_ORG_ID: '1',
      MCP_HTTP_HOST: '0.0.0.0',
    }),
    timeout: 10000,
  });
  if (result.status === 0 || !result.stderr.includes('MCP_HTTP_ALLOWED_HOSTS')) {
    fail('wildcard bind without MCP_HTTP_ALLOWED_HOSTS did not fail closed');
  }
  report('http_wildcard_without_allowed_hosts=fail_closed');
}

async function main() {
  const tarballPath = findTarball();
  inspectTarball(tarballPath);
  const consumer = mkdtempSync(join(tmpdir(), 'opensolar-mcp-consumer-'));
  try {
    const init = spawnSync('npm', ['init', '-y'], { cwd: consumer, encoding: 'utf8' });
    if (init.status !== 0) {
      fail(`npm init failed: ${init.stderr}`);
    }
    const install = spawnSync('npm', ['install', tarballPath], { cwd: consumer, encoding: 'utf8' });
    if (install.status !== 0) {
      fail(`npm install failed: ${install.stderr}`);
    }
    const packageRoot = join(consumer, 'node_modules', '@alignco', 'opensolar-mcp');
    const distIndex = join(packageRoot, 'dist', 'index.js');
    const bin = join(consumer, 'node_modules', '.bin', 'opensolar-mcp');
    if (distIndex.startsWith(repoRoot)) {
      fail('installed dist resolved inside the source checkout');
    }
    const installed = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    const repoManifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    if (installed.version !== repoManifest.version) {
      fail(`installed version ${installed.version} != ${repoManifest.version}`);
    }
    report(`installed_version=${installed.version}`);
    report(`consumer=${consumer}`);

    const help = runBin(bin, ['--help'], {});
    if (help.status !== 0 || !help.stdout.includes('--list-tools')) {
      fail('installed --help failed');
    }
    report('help=ok');

    const version = runBin(bin, ['--version'], {});
    if (version.status !== 0 || version.stdout.trim() !== installed.version) {
      fail(`installed --version printed ${JSON.stringify(version.stdout.trim())}`);
    }
    report('version=ok');

    const agent = runBin(bin, ['--list-tools'], {});
    if (agent.status !== 0) {
      fail(`agent --list-tools failed: ${agent.stderr}`);
    }
    assertSameNames(toolNames(agent.stdout), AGENT_TOOLS, 'agent profile');
    report(`agent_tool_count=${AGENT_TOOLS.length}`);

    const full = runBin(bin, ['--list-tools'], { OPENSOLAR_PROFILE: 'full' });
    if (full.status !== 0) {
      fail(`full --list-tools failed: ${full.stderr}`);
    }
    const fullNames = toolNames(full.stdout);
    if (fullNames.length !== 75) {
      fail(`full profile count ${fullNames.length}`);
    }
    report('full_tool_count=75');

    const webhooks = runBin(bin, ['--list-tools'], { OPENSOLAR_TOOLSETS: 'webhooks' });
    if (webhooks.status !== 0) {
      fail(`webhook --list-tools failed: ${webhooks.stderr}`);
    }
    assertSameNames(toolNames(webhooks.stdout), WEBHOOK_TOOLS, 'webhooks toolset');
    report('webhook_tool_count=5');

    const banana = runBin(bin, ['--list-tools'], { OPENSOLAR_PROFILE: 'banana' });
    if (banana.status === 0 || !banana.stderr.includes('Unknown OPENSOLAR_PROFILE: banana')) {
      fail('invalid profile did not fail clearly');
    }
    report('invalid_profile=fail_closed');

    const readOnlyTypo = runBin(bin, ['--list-tools'], { OPENSOLAR_READ_ONLY: 'ture' });
    if (readOnlyTypo.status === 0 || !readOnlyTypo.stderr.includes('Unknown OPENSOLAR_READ_ONLY')) {
      fail('invalid OPENSOLAR_READ_ONLY did not fail clearly');
    }
    report('invalid_read_only=fail_closed');

    await smokeStdio(distIndex, installed.version);
    await smokeHttp(distIndex);
    await smokePublicHttpAuth(distIndex);
    smokeFailClosed(distIndex);
    report('release_smoke=ok');
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

main().catch((error) => {
  if (process.exitCode !== 1) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
});
