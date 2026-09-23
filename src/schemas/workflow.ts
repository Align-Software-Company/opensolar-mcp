import { z } from 'zod';

const WorkflowStageSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    milestone: z.number().nullish(),
    order: z.number().nullish(),
    is_archived: z.boolean().nullish(),
  })
  .passthrough();

export const WorkflowSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    is_default: z.boolean().nullish(),
    is_archived: z.boolean().nullish(),
    workflow_stages: z.array(WorkflowStageSchema).nullish(),
  })
  .passthrough();

export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowListSchema = z.array(WorkflowSchema);

const CuratedWorkflowStageSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  milestone: z.number().nullish(),
  order: z.number().nullish(),
  is_archived: z.boolean().nullish(),
});

export const CuratedWorkflowSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  is_default: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
  workflow_stages: z.array(CuratedWorkflowStageSchema),
});

export type CuratedWorkflow = z.infer<typeof CuratedWorkflowSchema>;

export function curateWorkflow(workflow: Workflow): CuratedWorkflow {
  return {
    id: workflow.id,
    title: workflow.title,
    is_default: workflow.is_default,
    is_archived: workflow.is_archived,
    workflow_stages: (workflow.workflow_stages ?? []).map((stage) => ({
      id: stage.id,
      title: stage.title,
      milestone: stage.milestone,
      order: stage.order,
      is_archived: stage.is_archived,
    })),
  };
}

export const ListWorkflowsOutputSchema = z.object({
  workflows: z.array(CuratedWorkflowSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
