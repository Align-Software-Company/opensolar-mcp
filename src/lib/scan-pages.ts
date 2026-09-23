export class BareListPageError extends Error {}

export type ScanStoppedBy = 'end' | 'max_pages' | 'max_results';

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
}): Promise<PageScan<Match>> {
  const matches: Match[] = [];
  let pagesScanned = 0;
  let recordsScanned = 0;
  let lastPageLength = 0;
  let resultsTruncated = false;

  while (pagesScanned < input.maxPages) {
    const page = await input.fetchPage(pagesScanned + 1);
    pagesScanned += 1;
    lastPageLength = page.length;
    recordsScanned += page.length;
    for (const record of page) {
      const hit = input.match(record);
      if (hit === null) {
        continue;
      }
      if (matches.length < input.maxResults) {
        matches.push(hit);
      } else {
        resultsTruncated = true;
      }
    }
    if (lastPageLength < input.pageSize || resultsTruncated) {
      break;
    }
    if (matches.length >= input.maxResults) {
      break;
    }
  }

  const complete = lastPageLength < input.pageSize;
  const stoppedBy: ScanStoppedBy = resultsTruncated
    ? 'max_results'
    : complete
      ? 'end'
      : matches.length >= input.maxResults
        ? 'max_results'
        : 'max_pages';

  return {
    matches,
    pages_scanned: pagesScanned,
    records_scanned: recordsScanned,
    complete,
    results_truncated: resultsTruncated,
    stopped_by: stoppedBy,
  };
}
