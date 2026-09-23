import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@alignco/opensolar-mcp';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

// Vitest loads this module from src/lib. The published bundle is dist/index.js,
// and an installed copy lives under node_modules. package.json stays at the
// package root in each layout, so walk upward until that manifest is found.
export function readPackageVersion(moduleUrl: string = import.meta.url): string {
  let directory = dirname(fileURLToPath(moduleUrl));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(directory, 'package.json');
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as {
        name?: unknown;
        version?: unknown;
      };
      if (parsed.name === PACKAGE_NAME && typeof parsed.version === 'string') {
        return parsed.version;
      }
    } catch (error) {
      if (!isMissingFile(error)) {
        throw error;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
  throw new Error(`Could not read ${PACKAGE_NAME} version from package.json`);
}
