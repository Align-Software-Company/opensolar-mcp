/** `entity_type` values on Sharing entities to a connected org (bulk), retrieved 2026-09-22. */
export const SHARE_ENTITY_TYPES = [
  'pricing_schemes',
  'costings',
  'adders',
  'payment_options',
  'actions',
  'component_module_activations',
  'component_inverter_activations',
  'component_battery_activations',
  'component_other_activations',
  'project_configurations',
  'battery_schemes',
  'proposal_templates',
  'contracts',
  'testimonials',
  'incentives',
  'document_templates',
] as const;

export type ShareEntityType = (typeof SHARE_ENTITY_TYPES)[number];
