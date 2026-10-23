/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, and a
 * leading byte-order mark. Values are returned verbatim as strings; no value
 * (including "NA", which is Namibia's ISO code) is interpreted as missing.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new SyntaxError("Unterminated quoted field in CSV");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parses CSV with a header row into objects keyed by column name. */
export function parseCsvRecords(text: string): {
  header: string[];
  records: Record<string, string>[];
} {
  const [header = [], ...body] = parseCsv(text);
  const records = body
    .filter((cells) => !(cells.length === 1 && cells[0] === ""))
    .map((cells) =>
      Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])),
    );
  return { header, records };
}
