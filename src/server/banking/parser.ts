import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { assert, minor, sumMinor, validDate } from '../core';
import { bankDraftSchema, type BankDraft } from '../extraction/provider';
export type ParsedRow = {
  date: string;
  description: string;
  reference: string;
  direction: 'in' | 'out';
  amountMinor: number;
  balanceMinor: number | null;
  rowIndex: number;
};
export function validateStatement(
  draft: BankDraft,
  month: string,
): {
  rows: ParsedRow[];
  errors: string[];
  openingMinor: number | null;
  closingMinor: number | null;
} {
  const errors: string[] = [],
    rows: ParsedRow[] = [];
  let openingMinor: number | null = null,
    closingMinor: number | null = null;
  try {
    openingMinor = draft.opening === null || draft.opening === '' ? null : minor(draft.opening);
    closingMinor = draft.closing === null || draft.closing === '' ? null : minor(draft.closing);
  } catch {
    errors.push('Opening / closing balances must be decimal amounts.');
  }
  let running = openingMinor;
  for (const [idx, r] of draft.rows.entries()) {
    try {
      assert(validDate(r.date), 'date must be YYYY-MM-DD');
      assert(r.date.slice(0, 7) === month, 'date is outside selected month');
      assert(r.description.trim(), 'description is missing');
      const moneyIn = minor(r.moneyIn || '0'),
        moneyOut = minor(r.moneyOut || '0');
      assert(
        moneyIn >= 0 && moneyOut >= 0 && moneyIn > 0 !== moneyOut > 0,
        'exactly one of money_in or money_out must be positive',
      );
      const balance = r.balance === null || r.balance === '' ? null : minor(r.balance);
      if (running !== null) {
        running = sumMinor([running, moneyIn, -moneyOut]);
        if (balance !== null) assert(running === balance, 'running balance does not reconcile');
      } else if (balance !== null) running = balance;
      rows.push({
        date: r.date,
        description: r.description.trim(),
        reference: r.reference.trim(),
        direction: moneyIn > 0 ? 'in' : 'out',
        amountMinor: moneyIn || moneyOut,
        balanceMinor: balance,
        rowIndex: idx + 1,
      });
    } catch (e) {
      errors.push(`Row ${idx + 1}: ${e instanceof Error ? e.message : 'invalid data'}`);
    }
  }
  if (closingMinor !== null && running !== null && running !== closingMinor)
    errors.push('Calculated closing balance differs from the statement closing balance.');
  if (!draft.rows.length)
    errors.push('No transaction rows found. Enter verified rows or upload a structured statement.');
  return { rows, errors, openingMinor, closingMinor };
}
export async function parseStructured(data: Buffer, mime: string): Promise<BankDraft> {
  let table: string[][] = [];
  if (mime === 'text/csv')
    table = parse(data.toString('utf8'), {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 100000,
    });
  else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    assert(workbook.worksheets.length === 1, 'Use a workbook with one transaction sheet.');
    const sheet = workbook.worksheets[0];
    assert(
      sheet.rowCount <= 10001 && sheet.columnCount <= 30,
      'Statement exceeds 10,000 rows or 30 columns.',
    );
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = row.getCell(col);
        assert(
          cell.type !== ExcelJS.ValueType.Formula,
          'Formula cells are not accepted. Export values only.',
        );
        values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
      }
      table.push(values);
    });
  }
  assert(
    table.length > 1 && table.length <= 10001,
    'Statement must have headers and 1–10,000 rows.',
  );
  const headers = table[0].map((x) => x.toLowerCase().trim().replace(/[ -]+/g, '_'));
  const required = ['date', 'description', 'money_in', 'money_out'];
  for (const name of required)
    assert(headers.includes(name), `Missing column: ${name}. Use the downloadable CSV template.`);
  assert(new Set(headers).size === headers.length, 'Duplicate column headings are not allowed.');
  const rows = table.slice(1).map((row) => {
    const get = (name: string) => row[headers.indexOf(name)]?.trim() || '';
    return {
      date: get('date'),
      description: get('description'),
      reference: get('reference'),
      moneyIn: get('money_in'),
      moneyOut: get('money_out'),
      balance: get('balance') || null,
    };
  });
  return bankDraftSchema.parse({
    opening: null,
    closing: null,
    rows,
    notes:
      'Structured import. Review all rows and verify opening / closing balances against your statement.',
  });
}
