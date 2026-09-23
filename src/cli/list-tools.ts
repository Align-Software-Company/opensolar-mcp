import { loadToolFilters } from '../lib/config.js';
import { selectTools } from '../tools/index.js';

export function runListTools(): void {
  const names = selectTools(loadToolFilters());
  process.stdout.write(`${names.join('\n')}\n`);
}
