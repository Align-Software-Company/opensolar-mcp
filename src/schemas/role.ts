import { z } from 'zod';

export const RoleSchema = z
  .object({
    id: z.number(),
    display: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    job_title: z.string().nullish(),
    is_admin: z.boolean().nullish(),
  })
  .passthrough();

export type Role = z.infer<typeof RoleSchema>;

export const RoleListSchema = z.array(RoleSchema);

export const CuratedRoleSchema = z.object({
  id: z.number(),
  display: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  job_title: z.string().nullish(),
  is_admin: z.boolean().nullish(),
});

export type CuratedRole = z.infer<typeof CuratedRoleSchema>;

export function curateRole(role: Role): CuratedRole {
  return {
    id: role.id,
    display: role.display,
    email: role.email,
    phone: role.phone,
    job_title: role.job_title,
    is_admin: role.is_admin,
  };
}

export const ListRolesOutputSchema = z.object({
  roles: z.array(CuratedRoleSchema),
});
