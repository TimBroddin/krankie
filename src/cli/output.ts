import Table from "cli-table3";

export interface OutputOptions {
  json?: boolean;
}

export function output(data: unknown, opts: OutputOptions = {}): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (Array.isArray(data)) {
    console.log(data);
  } else {
    console.log(data);
  }
}

export function outputTable(
  headers: string[],
  rows: (string | number | null)[][],
  opts: OutputOptions = {}
): void {
  if (opts.json) {
    const objects = rows.map((row) =>
      headers.reduce(
        (obj, header, i) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[i];
          return obj;
        },
        {} as Record<string, unknown>
      )
    );
    console.log(JSON.stringify(objects, null, 2));
    return;
  }

  const table = new Table({
    head: headers,
    style: { head: ["cyan"] },
  });

  rows.forEach((row) => table.push(row.map((v) => (v === null ? "-" : String(v)))));
  console.log(table.toString());
}

export function outputSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

export function outputError(message: string): void {
  console.error(`✗ ${message}`);
}

export function outputWarning(message: string): void {
  console.warn(`⚠ ${message}`);
}
