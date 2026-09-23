import { z } from 'zod';

const FileTagDataSchema = z
  .object({
    title: z.string().nullish(),
  })
  .passthrough();

export const PrivateFileSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    project: z.string().nullish(),
    filesize: z.number().nullish(),
    content_type: z.string().nullish(),
    file_contents: z.string().nullish(),
    file_tags_data: z.array(FileTagDataSchema).nullish(),
  })
  .passthrough();

export type PrivateFile = z.infer<typeof PrivateFileSchema>;

export const PrivateFileListSchema = z.array(PrivateFileSchema);

export const PrivateFileRowSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  file_tags: z.array(z.string()),
  project_id: z.number().nullish(),
});

export const PrivateFileContentsSchema = z.object({
  encoding: z.enum(['text', 'base64']),
  body: z.string(),
  truncated: z.boolean().optional(),
});

export const PrivateFileDetailSchema = PrivateFileRowSchema.extend({
  size: z.number().nullish(),
  content_type: z.string().nullish(),
  contents: PrivateFileContentsSchema.optional(),
});

export type PrivateFileRow = z.infer<typeof PrivateFileRowSchema>;
export type PrivateFileDetail = z.infer<typeof PrivateFileDetailSchema>;

export function projectIdFromPrivateFile(project: string | null | undefined): number | null {
  if (project === null || project === undefined || project === '') {
    return null;
  }
  const match = project.match(/\/projects\/(\d+)\/?$/);
  if (match?.[1] === undefined) {
    return null;
  }
  return Number(match[1]);
}

export function fileTagTitles(file: PrivateFile): string[] {
  const tags = file.file_tags_data ?? [];
  return tags.flatMap((tag) => {
    if (tag.title === null || tag.title === undefined || tag.title === '') {
      return [];
    }
    return [tag.title];
  });
}

export function curatePrivateFile(file: PrivateFile): PrivateFileRow {
  return {
    id: file.id,
    title: file.title,
    file_tags: fileTagTitles(file),
    project_id: projectIdFromPrivateFile(file.project),
  };
}

export const GeneratedDocumentOutputSchema = z.object({
  id: z.number().int().positive(),
});

export const ListPrivateFilesOutputSchema = z.object({
  private_files: z.array(PrivateFileRowSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
