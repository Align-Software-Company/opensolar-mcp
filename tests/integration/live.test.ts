import { describe, expect, it } from 'vitest';

const live = Boolean(process.env.OPENSOLAR_TEST_TOKEN);

describe.skipIf(!live)('live OpenSolar', () => {
  it('runs only when OPENSOLAR_TEST_TOKEN is set', () => {
    expect(process.env.OPENSOLAR_TEST_TOKEN).toBeTruthy();
  });
});
