import { extractText, getDocumentProxy } from 'unpdf';

/** Text copied into model context. The 10 MB download cap is separate. */
export const MAX_MODEL_TEXT_CHARS = 100_000;

const PDF_TEXT_FAILED = 'PDF text could not be extracted.';

export type FileModelBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | {
      type: 'resource';
      resource: { uri: string; mimeType: string; blob: string };
    };

export function mediaType(contentType: string | null): string | null {
  if (contentType === null) {
    return null;
  }
  const media = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return media === '' ? null : media;
}

export function isTextMedia(media: string | null): boolean {
  if (media === null) {
    return false;
  }
  return (
    media.startsWith('text/') ||
    media === 'application/json' ||
    media === 'application/geo+json' ||
    media === 'application/xml' ||
    media.endsWith('+json') ||
    media.endsWith('+xml')
  );
}

export function truncateModelText(text: string): { body: string; omitted: number } {
  if (text.length <= MAX_MODEL_TEXT_CHARS) {
    return { body: text, omitted: 0 };
  }
  return {
    body: text.slice(0, MAX_MODEL_TEXT_CHARS),
    omitted: text.length - MAX_MODEL_TEXT_CHARS,
  };
}

export function modelTextBlock(body: string, omitted: number): string {
  if (omitted === 0) {
    return body;
  }
  const unit = omitted === 1 ? 'character' : 'characters';
  return `${body}\n[Truncated. ${omitted} ${unit} omitted.]`;
}

function pageSentence(pageCount: number): string {
  const pages = pageCount === 1 ? '1 page' : `${pageCount} pages`;
  return `PDF has ${pages} and no extractable text.`;
}

function binaryResource(id: number, bytes: Uint8Array, mimeType: string): FileModelBlock {
  return {
    type: 'resource',
    resource: {
      uri: `opensolar://private-files/${id}`,
      mimeType,
      blob: Buffer.from(bytes).toString('base64'),
    },
  };
}

async function readPdf(bytes: Uint8Array): Promise<{ pageCount: number; text: string } | null> {
  try {
    // pdf.js can consume the buffer while it indexes a broken file.
    const pdf = await getDocumentProxy(bytes.slice());
    try {
      const extracted = await extractText(pdf, { mergePages: true });
      return { pageCount: extracted.totalPages, text: extracted.text.trim() };
    } finally {
      await pdf.cleanup();
    }
  } catch {
    return null;
  }
}

export async function fileModelBlocks(input: {
  id: number;
  bytes: Uint8Array;
  contentType: string | null;
}): Promise<{
  blocks: FileModelBlock[];
  pageCount: number | null;
  textBody: string | null;
  omitted: number;
}> {
  const media = mediaType(input.contentType);
  if (isTextMedia(media)) {
    const decoded = new TextDecoder().decode(input.bytes);
    const { body, omitted } = truncateModelText(decoded);
    return {
      blocks: [{ type: 'text', text: modelTextBlock(body, omitted) }],
      pageCount: null,
      textBody: body,
      omitted,
    };
  }
  if (media?.startsWith('image/')) {
    return {
      blocks: [
        {
          type: 'image',
          data: Buffer.from(input.bytes).toString('base64'),
          mimeType: media,
        },
      ],
      pageCount: null,
      textBody: null,
      omitted: 0,
    };
  }
  if (media === 'application/pdf') {
    const pdf = await readPdf(input.bytes);
    const resource = binaryResource(input.id, input.bytes, 'application/pdf');
    if (pdf === null) {
      return {
        blocks: [{ type: 'text', text: PDF_TEXT_FAILED }, resource],
        pageCount: null,
        textBody: null,
        omitted: 0,
      };
    }
    const { body, omitted } = truncateModelText(pdf.text);
    const text = pdf.text === '' ? pageSentence(pdf.pageCount) : modelTextBlock(body, omitted);
    return {
      blocks: [{ type: 'text', text }, resource],
      pageCount: pdf.pageCount,
      textBody: null,
      omitted,
    };
  }
  return {
    blocks: [binaryResource(input.id, input.bytes, media ?? 'application/octet-stream')],
    pageCount: null,
    textBody: null,
    omitted: 0,
  };
}
