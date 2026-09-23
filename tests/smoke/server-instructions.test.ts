import { describe, expect, it } from 'vitest';
import { SERVER_INSTRUCTIONS } from '../../src/lib/server-instructions.js';

describe('server instructions', () => {
  it('stays self-contained and omits the contract matrix and machine-user setup', () => {
    expect(SERVER_INSTRUCTIONS).not.toContain('api-contract-matrix');
    expect(SERVER_INSTRUCTIONS.toLowerCase()).not.toContain('machine user');
    expect(SERVER_INSTRUCTIONS.toLowerCase()).not.toContain('7-day');
    expect(SERVER_INSTRUCTIONS.split('\n').length).toBeLessThanOrEqual(12);
    expect(SERVER_INSTRUCTIONS).toContain('Read before you mutate');
    expect(SERVER_INSTRUCTIONS).toContain('resolution=unique');
    expect(SERVER_INSTRUCTIONS).toContain('resolution=incomplete');
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toContain('do not guess');
    expect(SERVER_INSTRUCTIONS).toContain('one page');
    expect(SERVER_INSTRUCTIONS).toContain('design');
    expect(SERVER_INSTRUCTIONS).toContain('Do not invent IDs');
  });
});
