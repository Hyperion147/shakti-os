/** Quote every cell and neutralize spreadsheet formulas in untrusted report text. */
/** Leading whitespace and C0 controls are skipped before the formula check. */
function hasFormulaPrefix(value: string): boolean {
  for (const char of value) {
    if (/\s/u.test(char)) continue;
    if ((char.codePointAt(0) ?? 0x20) < 0x20) continue;
    return char === "=" || char === "+" || char === "-" || char === "@";
  }
  return false;
}

export function csvCell(value: string): string {
  const safe = hasFormulaPrefix(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
