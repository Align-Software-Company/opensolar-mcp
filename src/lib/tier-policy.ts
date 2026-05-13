export type TierRequirement = 'api_access' | 'raw_data';

export type ToolPolicy = {
  requires: TierRequirement;
  mutation: boolean;
  degradesWith?: readonly string[];
};

export const TIER_POLICY = {
  list_projects: { requires: 'api_access', mutation: false },
  list_contacts: { requires: 'api_access', mutation: false },
  get_contact: { requires: 'api_access', mutation: false },
  get_org: { requires: 'api_access', mutation: false },
  get_project: { requires: 'api_access', mutation: false, degradesWith: ['design'] },
} as const satisfies Record<string, ToolPolicy>;

export type ToolName = keyof typeof TIER_POLICY;
