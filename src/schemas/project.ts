import { z } from 'zod';

export const ProjectSummarySchema = z
  .object({
    id: z.number(),
    address: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
  })
  .passthrough();

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectListSchema = z.array(ProjectSummarySchema);
export type ProjectList = z.infer<typeof ProjectListSchema>;

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
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    design: z.string().nullish(),
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

  return {
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
  };
}
