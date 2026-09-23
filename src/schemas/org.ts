import { z } from 'zod';

export const OrgSchema = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    address: z.string().nullish(),
    locality: z.string().nullish(),
    state: z.string().nullish(),
    zip: z.string().nullish(),
    country: z.string().nullish(),
    country_iso2: z.string().nullish(),
    company_email: z.string().nullish(),
    company_website: z.string().nullish(),
    sales_phone_number: z.string().nullish(),
    service_offering: z.string().nullish(),
    measurement_units: z.string().nullish(),
    is_active: z.boolean().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
  })
  .passthrough();

export type Org = z.infer<typeof OrgSchema>;

const CURATED_KEYS = [
  'id',
  'name',
  'address',
  'locality',
  'state',
  'zip',
  'country',
  'country_iso2',
  'company_email',
  'company_website',
  'sales_phone_number',
  'service_offering',
  'measurement_units',
  'is_active',
  'created_date',
  'modified_date',
] as const;

export type OrgCurated = Pick<Org, (typeof CURATED_KEYS)[number]>;

export function curateOrg(org: Org): OrgCurated {
  return {
    id: org.id,
    name: org.name,
    address: org.address,
    locality: org.locality,
    state: org.state,
    zip: org.zip,
    country: org.country,
    country_iso2: org.country_iso2,
    company_email: org.company_email,
    company_website: org.company_website,
    sales_phone_number: org.sales_phone_number,
    service_offering: org.service_offering,
    measurement_units: org.measurement_units,
    is_active: org.is_active,
    created_date: org.created_date,
    modified_date: org.modified_date,
  };
}

export const OrgCuratedSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  address: z.string().nullish(),
  locality: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  country: z.string().nullish(),
  country_iso2: z.string().nullish(),
  company_email: z.string().nullish(),
  company_website: z.string().nullish(),
  sales_phone_number: z.string().nullish(),
  service_offering: z.string().nullish(),
  measurement_units: z.string().nullish(),
  is_active: z.boolean().nullish(),
  created_date: z.string().nullish(),
  modified_date: z.string().nullish(),
});

export const GetOrgOutputSchema = OrgCuratedSchema.passthrough();
