import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const roots = [join(repoRoot, 'README.md'), join(repoRoot, 'docs')];

const liveIdentifierPatterns = [
  { label: 'literal OpenSolar org id', pattern: /\borg[- ]\d{4,}\b/i },
  { label: 'literal OpenSolar org path', pattern: /\/orgs\/\d{4,}\//i },
  { label: 'literal OpenSolar project id', pattern: /\bproject\s+\d{6,}\b/i },
  { label: 'literal OpenSolar project path', pattern: /\/projects\/\d{6,}\//i },
  { label: 'literal OpenSolar event id', pattern: /\bevents?\s+\d{6,}\b/i },
  {
    label: 'literal UUID in public docs',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  },
];

function filesUnder(path) {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  const files = [];
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) {
      files.push(...filesUnder(child));
    } else if (child.endsWith('.md')) {
      files.push(child);
    }
  }
  return files;
}

const failures = [];
for (const path of roots.flatMap(filesUnder)) {
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    for (const rule of liveIdentifierPatterns) {
      if (rule.pattern.test(line)) {
        failures.push(`${relative(repoRoot, path)}:${index + 1}: ${rule.label}: ${line.trim()}`);
      }
    }
    if (relative(repoRoot, path) === 'docs/source-log.md' && /^\|\s*\d{4,}\s*\|/.test(line)) {
      failures.push(
        `${relative(repoRoot, path)}:${index + 1}: numeric live-org table key: ${line.trim()}`,
      );
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(
    [
      'Public documentation contains literal live-environment identifiers.',
      'Use descriptive placeholders such as <live-org>, <fixture-project>, or <fixture-system-uuid>.',
      ...failures,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.stdout.write('public_doc_hygiene=ok\n');
