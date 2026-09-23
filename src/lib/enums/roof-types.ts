export const ROOF_TYPES = {
  6: 'Composition / Asphalt Shingle',
  7: 'Flat Concrete',
  8: 'Flat Foam',
  9: 'Membrane EPDM',
  10: 'Membrane PVC',
  11: 'Membrane TPO',
  12: 'Metal Decramastic',
  13: 'Metal Shingle',
  14: 'Metal Standing Seam',
  15: 'Metal Stone Coated',
  16: 'Metal Tin',
  17: 'Tar and Gravel / Bitumen',
  18: 'Thatched',
  19: 'Tile Clay',
  20: 'Tile Concrete',
  21: 'Tile Slate',
  22: 'Wood/Shake Shingle',
  23: 'Other',
  24: 'Kliplock',
} as const;

export type RoofTypeId = keyof typeof ROOF_TYPES;
export type RoofTypeTitle = (typeof ROOF_TYPES)[RoofTypeId];
