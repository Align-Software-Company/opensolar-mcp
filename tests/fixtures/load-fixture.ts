import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const opensolarRoot = join(dirname(fileURLToPath(import.meta.url)), 'opensolar');

export function loadOpenSolarFixture(entity: string, name: string): unknown {
  const fixturePath = join(opensolarRoot, entity, `${name}.json`);
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
}
