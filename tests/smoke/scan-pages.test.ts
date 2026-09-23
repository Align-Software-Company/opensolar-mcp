import { describe, expect, it } from 'vitest';
import { scanPaginatedCollection, searchResolution } from '../../src/lib/scan-pages.js';

describe('scanPaginatedCollection', () => {
  it('treats a short final page as a finished scan', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 5,
      maxResults: 10,
      fetchPage: async () => ['a'],
      match: (record: string) => record,
      strength: () => 0,
    });
    expect(scan).toMatchObject({
      matches: ['a'],
      pages_scanned: 1,
      records_scanned: 1,
      complete: true,
      results_truncated: false,
      stopped_by: 'end',
    });
  });

  it('stops at max_pages when the last page is full', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 1,
      maxResults: 10,
      fetchPage: async () => ['a', 'b'],
      match: () => null,
      strength: () => 0,
    });
    expect(scan).toMatchObject({
      complete: false,
      results_truncated: false,
      stopped_by: 'max_pages',
      pages_scanned: 1,
    });
  });

  it('keeps a short page complete when matches exceed max_results', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 100,
      maxPages: 5,
      maxResults: 10,
      fetchPage: async () => Array.from({ length: 50 }, (_, index) => index),
      match: (record: number) => (record < 15 ? record : null),
      strength: () => 0,
    });
    expect(scan.matches).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(scan).toMatchObject({
      complete: true,
      results_truncated: true,
      stopped_by: 'end',
      records_scanned: 50,
    });
  });

  it('keeps reading later pages after max_results is already filled', async () => {
    const pages: number[] = [];
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 2,
      maxResults: 1,
      fetchPage: async (page) => {
        pages.push(page);
        return page === 1
          ? [
              { id: 'weak', strength: 2 },
              { id: 'also-weak', strength: 2 },
            ]
          : [{ id: 'strong', strength: 0 }];
      },
      match: (record: { id: string; strength: number }) => record,
      strength: (record) => record.strength,
    });
    expect(pages).toEqual([1, 2]);
    expect(scan.matches.map((record) => record.id)).toEqual(['strong']);
    expect(scan).toMatchObject({
      complete: true,
      results_truncated: true,
      stopped_by: 'end',
    });
  });

  it('keeps upstream order between equal strengths', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 10,
      maxPages: 1,
      maxResults: 2,
      fetchPage: async () => ['a', 'b', 'c'],
      match: (record: string) => record,
      strength: () => 0,
    });
    expect(scan.matches).toEqual(['a', 'b']);
    expect(scan).toMatchObject({
      complete: true,
      results_truncated: true,
      stopped_by: 'end',
    });
  });

  it('reports truncation on an unfinished scan', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 1,
      maxResults: 1,
      fetchPage: async () => ['a', 'b'],
      match: (record: string) => record,
      strength: () => 0,
    });
    expect(scan.matches).toEqual(['a']);
    expect(scan).toMatchObject({
      complete: false,
      results_truncated: true,
      stopped_by: 'max_pages',
    });
  });

  it('treats an empty collection as exhausted', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 100,
      maxPages: 5,
      maxResults: 10,
      fetchPage: async () => [],
      match: () => null,
      strength: () => 0,
    });
    expect(scan).toMatchObject({
      matches: [],
      complete: true,
      results_truncated: false,
      stopped_by: 'end',
      records_scanned: 0,
    });
  });

  it('classifies resolution without treating truncated or unfinished single rows as unique', () => {
    expect(searchResolution({ matchCount: 0, complete: true, resultsTruncated: false })).toBe(
      'none',
    );
    expect(searchResolution({ matchCount: 1, complete: true, resultsTruncated: false })).toBe(
      'unique',
    );
    expect(searchResolution({ matchCount: 1, complete: true, resultsTruncated: true })).toBe(
      'ambiguous',
    );
    expect(searchResolution({ matchCount: 1, complete: false, resultsTruncated: false })).toBe(
      'incomplete',
    );
    expect(searchResolution({ matchCount: 2, complete: false, resultsTruncated: false })).toBe(
      'ambiguous',
    );
  });

});
