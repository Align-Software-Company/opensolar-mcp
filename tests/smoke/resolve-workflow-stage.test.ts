import { describe, expect, it } from 'vitest';
import { resolveWorkflowStage } from '../../src/lib/resolve-workflow-stage.js';

const stages = [
  { id: 1, title: 'New' },
  { id: 2, title: 'Sold' },
  { id: 3, title: ' sold ' },
];

describe('resolveWorkflowStage', () => {
  it('matches a normalized title', () => {
    expect(resolveWorkflowStage(stages, '  new ')).toEqual({ status: 'match', stageId: 1 });
  });

  it('returns the existing titles when nothing matches', () => {
    expect(resolveWorkflowStage(stages, 'Installed')).toEqual({
      status: 'none',
      titles: ['New', 'Sold', 'sold'],
    });
  });

  it('does not pick when two titles fold to the same text', () => {
    expect(resolveWorkflowStage(stages, 'Sold')).toEqual({
      status: 'ambiguous',
      stageIds: [2, 3],
      titles: ['Sold', 'sold'],
    });
  });
});
