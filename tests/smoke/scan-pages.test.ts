import { describe, expect, it } from 'vitest';
import { scanPaginatedCollection } from '../../src/lib/scan-pages.js';

describe('scanPaginatedCollection', () => {
  it('treats a short final page as a finished scan', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 5,
      maxResults: 10,
      fetchPage: async () => ['a'],
      match: (record: string) => record,
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
    });
    expect(scan.matches).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(scan).toMatchObject({
      complete: true,
      results_truncated: true,
      stopped_by: 'max_results',
      records_scanned: 50,
    });
  });

  it('does not fetch another page after max_results is filled', async () => {
    const pages: number[] = [];
    const scan = await scanPaginatedCollection({
      pageSize: 2,
      maxPages: 5,
      maxResults: 2,
      fetchPage: async (page) => {
        pages.push(page);
        return ['a', 'b'];
      },
      match: (record: string) => record,
    });
    expect(pages).toEqual([1]);
    expect(scan).toMatchObject({
      matches: ['a', 'b'],
      complete: false,
      results_truncated: false,
      stopped_by: 'max_results',
    });
  });

  it('treats an empty collection as exhausted', async () => {
    const scan = await scanPaginatedCollection({
      pageSize: 100,
      maxPages: 5,
      maxResults: 10,
      fetchPage: async () => [],
      match: () => null,
    });
    expect(scan).toMatchObject({
      matches: [],
      complete: true,
      results_truncated: false,
      stopped_by: 'end',
      records_scanned: 0,
    });
  });
});
