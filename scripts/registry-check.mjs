import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const server = JSON.parse(readFileSync(join(repoRoot, 'server.json'), 'utf8'));

const failures = [];

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

expectEqual(
  server.$schema,
  'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  'server.json $schema',
);
expectEqual(server.name, pkg.mcpName, 'server name / package mcpName');
expectEqual(server.version, pkg.version, 'server version / package version');

const npmPackage = Array.isArray(server.packages)
  ? server.packages.find((entry) => entry?.registryType === 'npm')
  : undefined;

if (!npmPackage) {
  failures.push('server.json must declare an npm package');
} else {
  expectEqual(npmPackage.identifier, pkg.name, 'registry package identifier / package name');
  expectEqual(npmPackage.version, pkg.version, 'registry package version / package version');
  expectEqual(npmPackage.transport?.type, 'stdio', 'registry package transport');

  const env = new Map((npmPackage.environmentVariables ?? []).map((entry) => [entry.name, entry]));
  const token = env.get('OPENSOLAR_API_TOKEN');
  const orgId = env.get('OPENSOLAR_ORG_ID');

  if (
    !token ||
    token.isRequired !== true ||
    token.isSecret !== true ||
    token.format !== 'string'
  ) {
    failures.push('OPENSOLAR_API_TOKEN must be required, secret, and string-formatted in server.json');
  }
  if (
    !orgId ||
    orgId.isRequired !== true ||
    orgId.isSecret !== false ||
    orgId.format !== 'number' ||
    orgId.placeholder !== '12345'
  ) {
    failures.push(
      'OPENSOLAR_ORG_ID must be required, non-secret, number-formatted, and use placeholder 12345 in server.json',
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(['MCP Registry metadata check failed:', ...failures, ''].join('\n'));
  process.exit(1);
}

process.stdout.write('registry_metadata=ok\n');
