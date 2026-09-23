import { z } from 'zod';
import { CONTACT_MATCH_FIELDS, MATCH_TYPES, PROJECT_MATCH_FIELDS } from '../lib/entity-match.js';
import { EnrichedContactSchema } from './contact.js';
import { ProjectListRowOutputSchema } from './project.js';

export const SEARCH_PAGE_SIZE = 100;
export const SEARCH_MAX_PAGES = 20;
export const SEARCH_DEFAULT_PAGES = 5;
export const SEARCH_MAX_RESULTS = 25;
export const SEARCH_DEFAULT_RESULTS = 10;

export const SearchInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(1)
      .describe('Text to match locally. Not sent to OpenSolar as a search query.'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_PAGES)
      .default(SEARCH_DEFAULT_PAGES)
      .describe('Pages to read, from 1 to 20. Defaults to 5. This cap is an MCP work bound.'),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_RESULTS)
      .default(SEARCH_DEFAULT_RESULTS)
      .describe('Matches to return, from 1 to 25. Defaults to 10.'),
  })
  .strict();

export const SearchReportSchema = z
  .object({
    query: z.string(),
    records_scanned: z.number().int().nonnegative(),
    pages_scanned: z.number().int().nonnegative(),
    complete: z.boolean(),
    results_truncated: z.boolean(),
    stopped_by: z.enum(['end', 'max_pages', 'max_results']),
  })
  .strict();

export const ContactMatchSchema = z
  .object({
    field: z.enum(CONTACT_MATCH_FIELDS),
    type: z.enum(MATCH_TYPES),
  })
  .strict();

export const ProjectMatchSchema = z
  .object({
    field: z.enum(PROJECT_MATCH_FIELDS),
    type: z.enum(MATCH_TYPES),
  })
  .strict();

export const SearchContactsOutputSchema = z
  .object({
    matches: z.array(EnrichedContactSchema.and(z.object({ match: ContactMatchSchema }).strict())),
    search: SearchReportSchema,
  })
  .strict();

export const SearchProjectsOutputSchema = z
  .object({
    matches: z.array(
      ProjectListRowOutputSchema.and(z.object({ match: ProjectMatchSchema }).strict()),
    ),
    search: SearchReportSchema,
  })
  .strict();
