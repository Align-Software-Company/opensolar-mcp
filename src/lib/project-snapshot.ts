import { messageForOpenSolarError } from '../client/errors.js';
import { OpenSolarApiError, type OpenSolarClient } from '../client/index.js';
import { ContactSchema } from '../schemas/contact.js';
import { curateProjectEvent, type Event } from '../schemas/event.js';
import { curatePaymentOption, PaymentOptionSchema } from '../schemas/payment.js';
import {
  curatePrivateFile,
  type PrivateFile,
  PrivateFileListSchema,
} from '../schemas/private-file.js';
import { ProjectFullSchema, stageMilestoneLabel } from '../schemas/project.js';
import type { ProjectSnapshot } from '../schemas/project-snapshot.js';
import { curateSystemListRow, SystemListSchema } from '../schemas/system.js';
import { WorkflowSchema } from '../schemas/workflow.js';
import { enrichContact } from './contact-enrich.js';

const SYSTEMS_PAGE_SIZE = 100;
const FILE_SAMPLE = 5;
const EVENT_SAMPLE = 5;

type Gap = { gap: string };

export async function loadProjectSnapshot(
  client: OpenSolarClient,
  orgId: number,
  projectId: number,
): Promise<ProjectSnapshot> {
  const [projectRead, systemsRead] = await Promise.all([
    readSection(client, `orgs/${orgId}/projects/${projectId}/`),
    readSection(
      client,
      `orgs/${orgId}/systems/?fieldset=list&project=${projectId}&page=1&limit=${SYSTEMS_PAGE_SIZE}`,
    ),
  ]);

  const snapshot: ProjectSnapshot = {
    project: { gap: 'Project was not loaded' },
    contacts: { gap: 'Project was not loaded' },
    systems: systemsFrom(systemsRead),
    files: { gap: 'Project was not loaded' },
  };

  if (!('ok' in projectRead)) {
    snapshot.project = projectRead;
    snapshot.contacts = projectRead;
    snapshot.workflow = projectRead;
    snapshot.events = projectRead;
    snapshot.files = await filesFromList(client, orgId, projectId);
    return snapshot;
  }

  const parsed = ProjectFullSchema.safeParse(projectRead.ok);
  if (!parsed.success) {
    const gap = { gap: 'Project payload did not match the documented shape' };
    snapshot.project = gap;
    snapshot.contacts = gap;
    snapshot.workflow = gap;
    snapshot.events = gap;
    snapshot.files = await filesFromList(client, orgId, projectId);
    return snapshot;
  }

  const project = parsed.data;
  const record = recordOf(project);
  const projectRow: ProjectSnapshot['project'] = {
    id: project.id,
    title: project.title,
    address: project.address,
    created_date: project.created_date,
    modified_date: project.modified_date,
  };
  const milestone = stageMilestoneLabel(project.stage);
  if (milestone !== undefined && !('gap' in projectRow)) {
    projectRow.stage_milestone = milestone;
  }
  snapshot.project = projectRow;

  snapshot.contacts = (project.contacts_data ?? []).flatMap((contact) => {
    const parsedContact = ContactSchema.safeParse(contact);
    if (!parsedContact.success) {
      return [];
    }
    const enriched = enrichContact(parsedContact.data);
    const fields = recordOf(enriched);
    return [
      {
        id: enriched.id,
        display: stringOrNull(fields.display),
        email: stringOrNull(fields.email),
        phone: stringOrNull(fields.phone),
        is_synthetic_email: enriched.is_synthetic_email,
      },
    ];
  });

  if (project.assigned_role_data) {
    snapshot.assigned_role = { display: project.assigned_role_data.display };
  }

  const usage = usageSummary(record.usage);
  if (usage !== null) {
    snapshot.usage = usage;
  }

  if (project.events_data !== undefined && project.events_data !== null) {
    snapshot.events = recentEvents(project.events_data);
  }

  const shares = shareRows(record.shared_with);
  if (shares !== null) {
    snapshot.shared_with = shares;
  }

  const workflowId = project.workflow?.workflow_id;
  const activeStageId = project.workflow?.active_stage_id;
  const soldOptionId = paymentOptionId(record.payment_option_sold);
  const embeddedFiles = record.private_files_data;
  const [workflow, paymentOption, files] = await Promise.all([
    workflowId === undefined
      ? undefined
      : workflowSection(client, orgId, workflowId, activeStageId),
    soldOptionId === null ? undefined : paymentSection(client, orgId, soldOptionId),
    Array.isArray(embeddedFiles)
      ? filesFromEmbedded(embeddedFiles)
      : filesFromList(client, orgId, projectId),
  ]);
  if (workflow !== undefined) {
    snapshot.workflow = workflow;
  }
  if (paymentOption !== undefined) {
    snapshot.payment_option = paymentOption;
  }
  snapshot.files = files;

  return snapshot;
}

async function workflowSection(
  client: OpenSolarClient,
  orgId: number,
  workflowId: number,
  activeStageId: number | undefined,
): Promise<ProjectSnapshot['workflow']> {
  const read = await readSection(client, `orgs/${orgId}/workflows/${workflowId}/`);
  if (!('ok' in read)) {
    return read;
  }
  const parsed = WorkflowSchema.safeParse(read.ok);
  if (!parsed.success) {
    return { gap: 'Workflow payload did not match the documented shape' };
  }
  const stage = (parsed.data.workflow_stages ?? []).find((item) => item.id === activeStageId);
  const section: {
    workflow_id: number;
    title: string | null | undefined;
    active_stage_id?: number;
    active_stage_title?: string | null;
    milestone?: string;
  } = {
    workflow_id: workflowId,
    title: parsed.data.title,
  };
  if (activeStageId !== undefined) {
    section.active_stage_id = activeStageId;
  }
  if (stage?.title !== undefined && stage.title !== null) {
    section.active_stage_title = stage.title;
  }
  const milestone = stageMilestoneLabel(stage?.milestone);
  if (milestone !== undefined) {
    section.milestone = milestone;
  }
  return section;
}

async function paymentSection(
  client: OpenSolarClient,
  orgId: number,
  optionId: number,
): Promise<NonNullable<ProjectSnapshot['payment_option']>> {
  const read = await readSection(client, `orgs/${orgId}/payment_options/${optionId}/`);
  if (!('ok' in read)) {
    return read;
  }
  const parsed = PaymentOptionSchema.safeParse(read.ok);
  if (!parsed.success) {
    return { gap: 'Payment option payload did not match the documented shape' };
  }
  const row = curatePaymentOption(parsed.data);
  return { id: row.id, title: row.title, payment_type: row.payment_type };
}

function systemsFrom(read: { ok: unknown } | Gap): ProjectSnapshot['systems'] {
  if (!('ok' in read)) {
    return read;
  }
  const parsed = SystemListSchema.safeParse(read.ok);
  if (!parsed.success) {
    return { gap: 'Systems payload did not match the documented shape' };
  }
  return {
    systems: parsed.data.map((system) => {
      const row = curateSystemListRow(system);
      return {
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        kw_stc: row.kw_stc,
        module_quantity: row.module_quantity,
        battery_total_kwh: row.battery_total_kwh,
        output_annual_kwh: row.output_annual_kwh,
      };
    }),
    list_complete: parsed.data.length < SYSTEMS_PAGE_SIZE,
  };
}

async function filesFromList(
  client: OpenSolarClient,
  orgId: number,
  projectId: number,
): Promise<ProjectSnapshot['files']> {
  const read = await readSection(
    client,
    `orgs/${orgId}/private_files/?project=${projectId}&page=1&limit=${FILE_SAMPLE}&ordering=-created_date`,
  );
  if (!('ok' in read)) {
    return read;
  }
  const parsed = PrivateFileListSchema.safeParse(read.ok);
  if (!parsed.success) {
    return { gap: 'Private files payload did not match the documented shape' };
  }
  const sample = fileSample(parsed.data);
  const pageEnded = parsed.data.length < FILE_SAMPLE;
  return {
    returned_count: sample.length,
    total_count: pageEnded ? parsed.data.length : null,
    list_complete: pageEnded,
    files: sample,
  };
}

function filesFromEmbedded(value: unknown): ProjectSnapshot['files'] {
  const parsed = PrivateFileListSchema.safeParse(value);
  if (!parsed.success) {
    return { gap: 'Private files payload did not match the documented shape' };
  }
  const sample = fileSample(parsed.data);
  return {
    returned_count: sample.length,
    total_count: parsed.data.length,
    list_complete: true,
    files: sample,
  };
}

function fileSample(files: readonly PrivateFile[]): Array<{
  title: string | null | undefined;
  file_tags: string[];
}> {
  return files.slice(0, FILE_SAMPLE).map((file) => {
    const row = curatePrivateFile(file);
    return { title: row.title, file_tags: row.file_tags };
  });
}

function recentEvents(events: readonly Event[]): NonNullable<ProjectSnapshot['events']> {
  const ranked = events.map((event, index) => ({ event, index }));
  ranked.sort((left, right) => {
    const byDate = (right.event.created_date ?? '').localeCompare(left.event.created_date ?? '');
    return byDate !== 0 ? byDate : left.index - right.index;
  });
  return ranked.slice(0, EVENT_SAMPLE).map(({ event }) => {
    const curated = curateProjectEvent(event);
    return {
      id: curated.id,
      event_type_id: curated.event_type_id,
      event_type_name: curated.event_type_name,
      title: curated.title,
      start: curated.start,
      created_date: curated.created_date,
    };
  });
}

type UsagePeriod =
  | 'annual'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'daily_per_month'
  | 'estimate';

type UsageSummary = {
  usage_data_source: string;
  period?: UsagePeriod;
  unit?: 'kwh' | 'bill';
  period_count?: number;
  values?: number[];
  annual_total?: number;
  estimate?: string;
};

const usagePeriods: Record<
  string,
  {
    period: Exclude<UsagePeriod, 'estimate'>;
    unit: 'kwh' | 'bill';
    count: number;
    sumsToAnnual: boolean;
  }
> = {
  kwh_annual: { period: 'annual', unit: 'kwh', count: 1, sumsToAnnual: true },
  bill_annual: { period: 'annual', unit: 'bill', count: 1, sumsToAnnual: true },
  kwh_monthly: { period: 'monthly', unit: 'kwh', count: 12, sumsToAnnual: true },
  bill_monthly: { period: 'monthly', unit: 'bill', count: 12, sumsToAnnual: true },
  kwh_every_second_month: { period: 'bimonthly', unit: 'kwh', count: 6, sumsToAnnual: true },
  bill_every_second_month: { period: 'bimonthly', unit: 'bill', count: 6, sumsToAnnual: true },
  kwh_quarterly: { period: 'quarterly', unit: 'kwh', count: 4, sumsToAnnual: true },
  bill_quarterly: { period: 'quarterly', unit: 'bill', count: 4, sumsToAnnual: true },
  kwh_daily_per_month: { period: 'daily_per_month', unit: 'kwh', count: 12, sumsToAnnual: false },
};

function usageSummary(value: unknown): UsageSummary | null {
  const record = objectRecord(value);
  if (record === null || typeof record.usage_data_source !== 'string') {
    return null;
  }
  const source = record.usage_data_source;
  if (source === 'estimate') {
    const summary: UsageSummary = { usage_data_source: source, period: 'estimate' };
    if (typeof record.values === 'string') {
      summary.estimate = record.values;
    }
    return summary;
  }

  const known = usagePeriods[source];
  if (known === undefined) {
    const numbers = numberList(record.values);
    if (numbers !== null) {
      return { usage_data_source: source, values: numbers };
    }
    return { usage_data_source: source };
  }

  const base: UsageSummary = {
    usage_data_source: source,
    period: known.period,
    unit: known.unit,
  };
  if (known.count === 1) {
    if (typeof record.values !== 'number' || !Number.isFinite(record.values)) {
      return base;
    }
    return { ...base, period_count: 1, annual_total: record.values };
  }

  const numbers = numberList(record.values);
  if (numbers === null || numbers.length !== known.count) {
    return base;
  }
  const summary: UsageSummary = { ...base, period_count: known.count, values: numbers };
  if (known.sumsToAnnual) {
    summary.annual_total = numbers.reduce((sum, item) => sum + item, 0);
  }
  return summary;
}

function numberList(value: unknown): number[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'number' && Number.isFinite(item))
  ) {
    return null;
  }
  return value;
}

function shareRows(value: unknown): Array<{ org_id?: number; is_shared?: boolean }> | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((entry) => {
    if (typeof entry === 'number') {
      return [{ org_id: entry }];
    }
    const record = objectRecord(entry);
    if (record === null) {
      return [];
    }
    const row: { org_id?: number; is_shared?: boolean } = {};
    if (typeof record.org_id === 'number') {
      row.org_id = record.org_id;
    }
    if (typeof record.is_shared === 'boolean') {
      row.is_shared = record.is_shared;
    }
    return row.org_id === undefined && row.is_shared === undefined ? [] : [row];
  });
}

function paymentOptionId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const match = value.match(/\/payment_options\/(\d+)\/?$/);
    return match?.[1] === undefined ? null : Number(match[1]);
  }
  const record = objectRecord(value);
  if (
    record !== null &&
    typeof record.id === 'number' &&
    Number.isInteger(record.id) &&
    record.id > 0
  ) {
    return record.id;
  }
  return null;
}

async function readSection(client: OpenSolarClient, path: string): Promise<{ ok: unknown } | Gap> {
  try {
    return { ok: await client.get(path) };
  } catch (error) {
    if (error instanceof OpenSolarApiError) {
      return { gap: messageForOpenSolarError(error) };
    }
    throw error;
  }
}

function recordOf(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
