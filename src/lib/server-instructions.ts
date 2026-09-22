export const SERVER_INSTRUCTIONS = [
  'Read before you mutate: confirm the target with a get or list tool before any create, update, or delete.',
  'Pagination: list tools return one page. If the array length equals `limit`, request page+1. OpenSolar does not return page counts.',
  'Access plan: API Access omits or nulls some nested fields (notably project `design`). Raw Data is required for those payloads. See docs/api-contract-matrix.md.',
  'Mutation safety: writes change the live OpenSolar org. Do not invent IDs. Do not loop bulk operations; this server has no batch endpoints.',
].join('\n');
