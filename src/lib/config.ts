import { z } from 'zod';

export const BaseUrlSchema = z
  .string()
  .url()
  .default('https://api.opensolar.com/api/')
  .transform((value) => (value.endsWith('/') ? value : `${value}/`));

const ConfigSchema = z.object({
  OPENSOLAR_API_TOKEN: z.string().min(1, 'OPENSOLAR_API_TOKEN is required'),
  OPENSOLAR_ORG_ID: z.coerce.number().int().positive('OPENSOLAR_ORG_ID must be a positive integer'),
  BASE_URL: BaseUrlSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse({
    OPENSOLAR_API_TOKEN: process.env.OPENSOLAR_API_TOKEN,
    OPENSOLAR_ORG_ID: process.env.OPENSOLAR_ORG_ID,
    BASE_URL: process.env.OPENSOLAR_BASE_URL ?? undefined,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for required variables.`,
    );
  }

  return parsed.data;
}
