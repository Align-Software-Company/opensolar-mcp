import { describe, expect, it } from 'vitest';
import {
  asRecord,
  callLiveTool,
  liveOpenSolarClient,
  liveOrgId,
  liveReads,
  liveWrites,
  positiveId,
} from './support.js';

function configuredProjectId(): number | undefined {
  const raw = process.env.OPENSOLAR_TEST_PROJECT_ID;
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('OPENSOLAR_TEST_PROJECT_ID must be a positive integer');
  }
  return projectId;
}

describe.skipIf(!liveReads)('live project stage', () => {
  it('moves a dedicated fixture project and restores the original stage', async (ctx) => {
    if (!liveWrites) {
      ctx.skip('OPENSOLAR_INTEGRATION_WRITES is not 1');
      return;
    }
    const projectId = configuredProjectId();
    if (projectId === undefined) {
      ctx.skip('OPENSOLAR_TEST_PROJECT_ID is not set');
      return;
    }

    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const project = asRecord(await client.get(`orgs/${orgId}/projects/${projectId}/`));
    const workflow = asRecord(project.workflow ?? {});
    const workflowId = positiveId(workflow.workflow_id);
    const originalStageId = positiveId(workflow.active_stage_id);
    if (workflowId === undefined || originalStageId === undefined) {
      ctx.skip('the fixture project has no workflow stage to restore');
      return;
    }

    const workflowRecord = asRecord(await client.get(`orgs/${orgId}/workflows/${workflowId}/`));
    const stages = Array.isArray(workflowRecord.workflow_stages)
      ? workflowRecord.workflow_stages
      : [];
    const otherStageId = stages
      .map((stage) => positiveId(asRecord(stage).id))
      .find((id) => id !== undefined && id !== originalStageId);
    const nextStageId = otherStageId ?? originalStageId;

    try {
      const moved = asRecord(
        await callLiveTool(client, 'update_project_stage', {
          project_id: projectId,
          workflow_id: workflowId,
          active_stage_id: nextStageId,
        }),
      );
      expect(moved.active_stage_id).toBe(nextStageId);
    } finally {
      await callLiveTool(client, 'update_project_stage', {
        project_id: projectId,
        workflow_id: workflowId,
        active_stage_id: originalStageId,
      });
    }
  });
});
