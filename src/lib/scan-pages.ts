export class BareListPageError extends Error {}

export type ScanStoppedBy = 'end' | 'max_pages';

export type PageScan<Match> = {
  matches: Match[];
  pages_scanned: number;
  records_scanned: number;
  complete: boolean;
  results_truncated: boolean;
  stopped_by: ScanStoppedBy;
};

export async function scanPaginatedCollection<Record, Match>(input: {
  fetchPage: (page: number) => Promise<readonly Record[]>;
  pageSize: number;
  maxPages: number;
  maxResults: number;
  match: (record: Record) => Match | null;
  strength: (match: Match) => number;
}): Promise<PageScan<Match>> {
  const found: Match[] = [];
  let pagesScanned = 0;
  let recordsScanned = 0;
  let lastPageLength = 0;

  while (pagesScanned < input.maxPages) {
    const page = await input.fetchPage(pagesScanned + 1);
    pagesScanned += 1;
    lastPageLength = page.length;
    recordsScanned += page.length;
    for (const record of page) {
      const hit = input.match(record);
      if (hit !== null) {
        found.push(hit);
      }
    }
    if (lastPageLength < input.pageSize) {
      break;
    }
  }

  const ordered = found
    .map((hit, index) => ({ hit, index, strength: input.strength(hit) }))
    .sort((left, right) => left.strength - right.strength || left.index - right.index);
  const complete = lastPageLength < input.pageSize;

  return {
    matches: ordered.slice(0, input.maxResults).map((entry) => entry.hit),
    pages_scanned: pagesScanned,
    records_scanned: recordsScanned,
    complete,
    results_truncated: found.length > input.maxResults,
    stopped_by: complete ? 'end' : 'max_pages',
  };
}
