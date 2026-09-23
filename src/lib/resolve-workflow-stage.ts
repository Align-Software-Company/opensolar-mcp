import { foldText } from './entity-match.js';

export type WorkflowStageTitle = {
  id: number;
  title?: string | null;
};

export type StageResolution =
  | { status: 'match'; stageId: number }
  | { status: 'none'; titles: string[] }
  | { status: 'ambiguous'; stageIds: number[]; titles: string[] };

export function resolveWorkflowStage(
  stages: readonly WorkflowStageTitle[],
  stageName: string,
): StageResolution {
  const query = foldText(stageName);
  const titles = stages.flatMap((stage) => {
    if (typeof stage.title !== 'string') {
      return [];
    }
    const title = stage.title.trim();
    return title.length > 0 ? [title] : [];
  });
  const matches = stages.filter((stage) => {
    if (typeof stage.title !== 'string') {
      return false;
    }
    return foldText(stage.title) === query;
  });
  const first = matches[0];
  if (first === undefined) {
    return { status: 'none', titles };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      stageIds: matches.map((stage) => stage.id),
      titles: matches.flatMap((stage) =>
        typeof stage.title === 'string' && stage.title.trim().length > 0
          ? [stage.title.trim()]
          : [],
      ),
    };
  }
  return { status: 'match', stageId: first.id };
}
