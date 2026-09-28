import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const imageName = 'opensolar-mcp:ci';
const containerName = `opensolar-mcp-ci-${process.pid}`;
const containerPort = 3100;
const fixtureToken = 'docker-smoke-token';

function fail(message) {
  throw new Error(message);
}

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    fail(
      `docker ${args.join(' ')} failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
  return result.stdout?.trim() ?? '';
}

async function waitFor(url, predicate, label, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (predicate(response)) {
        return response;
      }
    } catch {
      // Container may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`${label} did not become ready at ${url}`);
}

function mappedPort() {
  const output = runDocker(['port', containerName, `${containerPort}/tcp`]);
  const line = output
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.startsWith('127.0.0.1:'));
  if (!line) {
    fail(`could not resolve Docker port mapping: ${output}`);
  }
  const port = Number(line.slice(line.lastIndexOf(':') + 1));
  if (!Number.isInteger(port) || port < 1) {
    fail(`invalid Docker port mapping: ${line}`);
  }
  return port;
}

async function main() {
  const build = spawnSync('docker', ['build', '-t', imageName, '.'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    fail(`docker build failed with exit ${build.status}`);
  }

  let started = false;
  try {
    runDocker([
      'run',
      '-d',
      '--rm',
      '--name',
      containerName,
      '-e',
      'OPENSOLAR_ORG_ID=1',
      '-e',
      `MCP_HTTP_PORT=${containerPort}`,
      '-p',
      `127.0.0.1::${containerPort}`,
      imageName,
    ]);
    started = true;

    const uid = runDocker(['exec', containerName, 'id', '-u']);
    if (uid === '0') {
      fail('Docker runtime is running as root');
    }

    const port = mappedPort();
    const origin = `http://127.0.0.1:${port}`;
    const health = await waitFor(`${origin}/health`, (response) => response.ok, 'health');
    if ((await health.json()).status !== 'ok') {
      fail('Docker /health payload was not ok');
    }
    const ready = await fetch(`${origin}/ready`);
    if (!ready.ok || (await ready.json()).status !== 'ready') {
      fail('Docker /ready payload was not ready');
    }

    const anonymous = await fetch(`${origin}/mcp`);
    if (anonymous.status !== 401) {
      fail(`Docker MCP without Authorization returned ${anonymous.status}, expected 401`);
    }

    const blockedOrigin = await fetch(`${origin}/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    if (blockedOrigin.status !== 403) {
      fail(`Docker untrusted Origin returned ${blockedOrigin.status}, expected 403`);
    }

    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${fixtureToken}` } },
    });
    const client = new Client({ name: 'docker-smoke', version: '0.0.0' });
    await client.connect(transport);
    try {
      const listed = await client.listTools();
      if (listed.tools.length !== 31) {
        fail(`Docker agent profile exposed ${listed.tools.length} tools, expected 31`);
      }
    } finally {
      await client.close();
    }

    process.stdout.write(
      [
        'docker_smoke=ok',
        `docker_runtime_uid=${uid}`,
        `docker_http_port=${containerPort}`,
        'docker_agent_tool_count=31',
        '',
      ].join('\n'),
    );
  } finally {
    if (started) {
      spawnSync('docker', ['stop', containerName], { cwd: repoRoot, stdio: 'ignore' });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
