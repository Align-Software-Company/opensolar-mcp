const PRIVATE_FILE_ID = /\/private_files\/(\d+)\/?/;

export function privateFileIdFromText(value: string): number | null {
  const match = PRIVATE_FILE_ID.exec(value);
  if (match?.[1] === undefined) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
