import { z } from 'zod';
import { SHARE_ENTITY_TYPES } from '../lib/enums/share-entities.js';

const positiveId = z.number().int().positive();

export const ConnectedOrgSchema = z
  .object({
    id: positiveId,
    org_name: z.string().nullable(),
    partner_org_id: positiveId.nullable(),
    permission_role_id: positiveId.nullable(),
    notify_roles: z.array(positiveId),
    is_active: z.boolean().nullable(),
    is_other_active: z.boolean().nullable(),
    is_other_enabled: z.boolean().nullable(),
  })
  .strict();

export const ConnectedOrgListSchema = z
  .object({
    connected_orgs: z.array(ConnectedOrgSchema),
    page: positiveId,
    limit: positiveId,
  })
  .strict();

export const ConnectionRequestSchema = z
  .object({
    item_id: positiveId,
    org_from_id: positiveId,
    org_from_name: z.string().nullable(),
    org_to_id: positiveId,
  })
  .strict();

export const ConnectionRequestListSchema = z
  .object({
    connection_requests: z.array(ConnectionRequestSchema),
  })
  .strict();

export const AcceptConnectionRequestOutputSchema = z
  .object({
    org_to_id: positiveId,
  })
  .strict();

export const ShareProjectOutputSchema = z
  .object({
    project_id: positiveId,
    org_id: positiveId,
    permission_role_id: positiveId,
    is_shared: z.boolean(),
  })
  .strict();

export const ShareEntitiesOutputSchema = z
  .object({
    entity_type: z.enum(SHARE_ENTITY_TYPES),
    ids: z.array(positiveId),
    share_with_ids: z.array(positiveId),
    unshare_with_ids: z.array(positiveId),
  })
  .strict();

export const PermissionRoleSchema = z
  .object({
    id: positiveId,
    title: z.string(),
  })
  .strict();

export type ConnectedOrg = z.infer<typeof ConnectedOrgSchema>;
export type ConnectionRequest = z.infer<typeof ConnectionRequestSchema>;
