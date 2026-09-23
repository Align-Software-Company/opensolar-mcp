import { z } from 'zod';
import {
  type CuratedProjectEvent,
  CuratedProjectEventSchema,
  curateProjectEvent,
  EventSchema,
} from './event.js';

const STAGE_MILESTONE_LABELS: Record<number, string> = {
  0: 'Presale',
  1: 'Lock Pricing',
  2: 'Sold',
  3: 'Installed',
  4: 'Others',
};

export function stageMilestoneLabel(stage: number | null | undefined): string | undefined {
  if (stage === null || stage === undefined) {
    return undefined;
  }
  return STAGE_MILESTONE_LABELS[stage];
}

const ProjectWorkflowSchema = z
  .object({
    workflow_id: z.number().optional(),
    active_stage_id: z.number().optional(),
  })
  .passthrough();

export type CuratedWorkflow = {
  workflow_id?: number;
  active_stage_id?: number;
};

export function curateWorkflow(value: unknown): CuratedWorkflow | undefined {
  const parsed = ProjectWorkflowSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  const workflow: CuratedWorkflow = {};
  if (parsed.data.workflow_id !== undefined) {
    workflow.workflow_id = parsed.data.workflow_id;
  }
  if (parsed.data.active_stage_id !== undefined) {
    workflow.active_stage_id = parsed.data.active_stage_id;
  }
  if (workflow.workflow_id === undefined && workflow.active_stage_id === undefined) {
    return undefined;
  }
  return workflow;
}

export const ProjectSummarySchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    address: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    stage: z.number().nullish(),
    workflow: ProjectWorkflowSchema.nullish(),
  })
  .passthrough();

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectListSchema = z.array(ProjectSummarySchema);
export type ProjectList = z.infer<typeof ProjectListSchema>;

export type ProjectListRow = {
  id: number;
  title: string | null | undefined;
  address: string | null | undefined;
  created_date: string | null | undefined;
  modified_date: string | null | undefined;
  stage: number | null | undefined;
  stage_milestone?: string;
  workflow?: CuratedWorkflow;
};

export function curateProjectListRow(p: ProjectSummary): ProjectListRow {
  const row: ProjectListRow = {
    id: p.id,
    title: p.title,
    address: p.address,
    created_date: p.created_date,
    modified_date: p.modified_date,
    stage: p.stage,
  };
  const milestone = stageMilestoneLabel(p.stage);
  if (milestone !== undefined) {
    row.stage_milestone = milestone;
  }
  const workflow = curateWorkflow(p.workflow);
  if (workflow !== undefined) {
    row.workflow = workflow;
  }
  return row;
}

const ContactDataSchema = z
  .object({
    id: z.number(),
    display: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
  })
  .passthrough();

const AssignedRoleDataSchema = z
  .object({
    id: z.number(),
    display: z.string().nullish(),
    email: z.string().nullish(),
  })
  .passthrough();

const SystemRefSchema = z.object({ id: z.number() }).passthrough();

export const ProjectFullSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    address: z.string().nullish(),
    locality: z.string().nullish(),
    state: z.string().nullish(),
    zip: z.string().nullish(),
    country_iso2: z.string().nullish(),
    lat: z.number().nullish(),
    lon: z.number().nullish(),
    stage: z.number().nullish(),
    contacts_data: z.array(ContactDataSchema).nullish(),
    systems: z.array(SystemRefSchema).nullish(),
    assigned_role_data: AssignedRoleDataSchema.nullish(),
    events_data: z.array(EventSchema).nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    design: z.string().nullish(),
    workflow: ProjectWorkflowSchema.nullish(),
  })
  .passthrough();

export type ProjectFull = z.infer<typeof ProjectFullSchema>;

export type CuratedContact = {
  id: number;
  display: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
};

export type CuratedAssignedRole = {
  id: number;
  display: string | null | undefined;
  email: string | null | undefined;
};

export type ProjectCurated = Pick<
  ProjectFull,
  | 'id'
  | 'title'
  | 'address'
  | 'locality'
  | 'state'
  | 'zip'
  | 'country_iso2'
  | 'lat'
  | 'lon'
  | 'stage'
  | 'created_date'
  | 'modified_date'
> & {
  contacts: CuratedContact[];
  system_count: number;
  assigned_role_data: CuratedAssignedRole | null;
  design_available: boolean;
  events: CuratedProjectEvent[];
  stage_milestone?: string;
  workflow?: CuratedWorkflow;
};

export function curateProject(p: ProjectFull): ProjectCurated {
  const contacts: CuratedContact[] = (p.contacts_data ?? []).map((c) => ({
    id: c.id,
    display: c.display,
    email: c.email,
    phone: c.phone,
  }));

  const assignedRole: CuratedAssignedRole | null = p.assigned_role_data
    ? {
        id: p.assigned_role_data.id,
        display: p.assigned_role_data.display,
        email: p.assigned_role_data.email,
      }
    : null;

  const curated: ProjectCurated = {
    id: p.id,
    title: p.title,
    address: p.address,
    locality: p.locality,
    state: p.state,
    zip: p.zip,
    country_iso2: p.country_iso2,
    lat: p.lat,
    lon: p.lon,
    stage: p.stage,
    created_date: p.created_date,
    modified_date: p.modified_date,
    contacts,
    system_count: p.systems?.length ?? 0,
    assigned_role_data: assignedRole,
    design_available: p.design !== undefined && p.design !== null,
    events: (p.events_data ?? []).map(curateProjectEvent),
  };
  const milestone = stageMilestoneLabel(p.stage);
  if (milestone !== undefined) {
    curated.stage_milestone = milestone;
  }
  const workflow = curateWorkflow(p.workflow);
  if (workflow !== undefined) {
    curated.workflow = workflow;
  }
  return curated;
}

export const CuratedWorkflowOutputSchema = z.object({
  workflow_id: z.number().optional(),
  active_stage_id: z.number().optional(),
});

export const ProjectListRowOutputSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    address: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    stage: z.number().nullish(),
    stage_milestone: z.string().optional(),
    workflow: CuratedWorkflowOutputSchema.optional(),
  })
  .passthrough();

export const ListProjectsOutputSchema = z.object({
  projects: z.array(ProjectListRowOutputSchema),
  page: z.number().int(),
  limit: z.number().int(),
});

const CuratedContactOutputSchema = z.object({
  id: z.number(),
  display: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
});

const CuratedAssignedRoleOutputSchema = z.object({
  id: z.number(),
  display: z.string().nullish(),
  email: z.string().nullish(),
});

export const GetProjectCuratedSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  address: z.string().nullish(),
  locality: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  country_iso2: z.string().nullish(),
  lat: z.number().nullish(),
  lon: z.number().nullish(),
  stage: z.number().nullish(),
  created_date: z.string().nullish(),
  modified_date: z.string().nullish(),
  contacts: z.array(CuratedContactOutputSchema),
  system_count: z.number().int(),
  assigned_role_data: CuratedAssignedRoleOutputSchema.nullable(),
  design_available: z.boolean(),
  events: z.array(CuratedProjectEventSchema),
  stage_milestone: z.string().optional(),
  workflow: CuratedWorkflowOutputSchema.optional(),
});

export const GetProjectOutputSchema = z.object({ id: z.number() }).passthrough();

export const ProjectWriteResultSchema = z.object({
  id: z.number(),
  address: z.string().nullish(),
});

export const ProjectStageResultSchema = z.object({
  project_id: z.number(),
  workflow_id: z.number(),
  active_stage_id: z.number(),
});

export const ProjectUsageResultSchema = z.object({
  project_id: z.number(),
  usage_data_source: z.string(),
});

export const DeletedRecordSchema = z.object({
  id: z.number(),
  deleted: z.literal(true),
});
