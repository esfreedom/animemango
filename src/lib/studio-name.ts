// The Thai studio name is shown only when it came from an official source (same rule as titles).
export function studioDisplayName(row: {
  nameRomaji: string;
  nameTh: string | null;
  nameThSourceUrl: string | null;
}): string {
  return row.nameTh && row.nameThSourceUrl ? row.nameTh : row.nameRomaji;
}
