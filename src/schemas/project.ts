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
