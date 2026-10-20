// Reading and writing CSV files (the format spreadsheets like Excel open).

type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Stop spreadsheet programs from running text that looks like a formula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

// Turns CSV text into a list of objects keyed by the (lower-cased, trimmed)
// header row. Handles quoted cells with commas, quotes and line breaks.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}
