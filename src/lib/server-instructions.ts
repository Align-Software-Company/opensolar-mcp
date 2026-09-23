export const SERVER_INSTRUCTIONS = [
  'Read before you mutate. Only a search result with resolution=unique confirms the target. resolution=incomplete means the bounded scan cannot prove uniqueness; ambiguous means more than one match was observed. Do not guess.',
  'Pagination: list tools return one page. If the array length equals `limit`, request page+1. OpenSolar does not return page counts.',
  'Access plan: API Access omits or nulls some nested fields, notably project `design`. Raw Data is required for those payloads.',
  'Writes change the live OpenSolar org. Do not invent IDs. Do not simulate bulk work by looping individual mutation calls. Use a documented bulk operation only when the MCP explicitly exposes one.',
  'Do not open files in this repository to answer OpenSolar questions.',
].join('\n');
