/**
 * Permission keys inside the Custom permission for Teams sample, retrieved 2026-09-22.
 * Each key has view, create, edit, and delete, each 0 or 1.
 */
export const TEAM_PERMISSION_KEYS = [
  'project',
  'info_contact_info_basic',
  'info_contact_info_full',
  'info_sales_and_marketing',
  'info_system_summary_section_pricing',
  'info_sale',
  'info_installation_info',
  'info_transactions',
  'info_documents',
  'info_sharing',
  'energy_usage_tariff',
  'design',
  'design_panels_build',
  'design_pricing',
  'design_costing_override',
  'design_commission_override',
  'design_incentives',
  'design_payment_options',
  'design_price_adders',
  'design_cost_breakdown',
  'design_tax_override',
  'proposal',
  'manage',
  'manage_notes_activities_actions',
  'manage_workflow_stages',
  'manage_assigned_users',
  'purchases_for_projects',
  'sld',
] as const;

export type TeamPermissionKey = (typeof TEAM_PERMISSION_KEYS)[number];
