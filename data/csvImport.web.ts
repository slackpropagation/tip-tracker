

// data/csvImport.web.ts
// Web-only CSV import: parse exported CSV, validate/normalize, and import via DB helpers.
// Designed to accept the CSV produced by data/csv.web.ts (computed_* columns are ignored).

import { insertShift, deleteAllShifts } from './db';

export type TipOutBasis = 'tips' | 'sales';

export type ShiftInsert = {
  date: string; // YYYY-MM-DD
  shift_type: string | null;
  hours_worked: number; // >= 0
  cash_tips: number | null;
  card_tips: number | null;
  tip_out_basis: TipOutBasis | null;
  tip_out_percent: number | null; // 0..100
  sales: number | null;
  tip_out_override_amount: number | null;
  base_hourly_wage: number | null;
  notes: string | null;
};

export type ParseResult = {
  rows: ShiftInsert[];
  errors: string[]; // human-readable issues
  header: string[]; // parsed header columns
  skipped: number; // number of rows skipped due to errors
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Map incoming CSV headers to our ShiftInsert keys (case-insensitive)
const HEADER_MAP: Record<string, keyof ShiftInsert | null> = {
  id: null, // ignored on import
  date: 'date',
  shift_type: 'shift_type',
  hours_worked: 'hours_worked',
  cash_tips: 'cash_tips',
  card_tips: 'card_tips',
  tip_out_basis: 'tip_out_basis',
  tip_out_percent: 'tip_out_percent',
  sales: 'sales',
  tip_out_override_amount: 'tip_out_override_amount',
  base_hourly_wage: 'base_hourly_wage',
  notes: 'notes',
  // Computed columns from export (ignored)
  computed_tip_out: null,
  computed_net_tips: null,
  computed_wages_earned: null,
  computed_effective_hourly: null,
  computed_shift_gross: null,
};

function splitCsvLine(line: string): string[] {
  // RFC4180-ish line splitter supporting quotes and escaped quotes
  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        cur += ch;
        i++;
        continue;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      cur += ch;
      i++;
    }
  }
  out.push(cur);
  return out;
}

function toLowerNoSpace(s: string): string {
  return s.trim().toLowerCase();
}

function toNumOrNull(v: string): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s.replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

function normalize(raw: Record<string, string>, rowIndex: number, errors: string[]): ShiftInsert | null {
  const get = (k: string) => raw[k];

  const date = (get('date') || '').trim();
  if (!DATE_RE.test(date)) {
    errors.push(`Row ${rowIndex}: invalid date "${date}" (expected YYYY-MM-DD)`);
    return null;
  }

  const hours = toNumOrNull(get('hours_worked')) ?? 0;
  if (hours < 0) {
    errors.push(`Row ${rowIndex}: hours_worked must be >= 0`);
    return null;
  }

  const cash = toNumOrNull(get('cash_tips'));
  const card = toNumOrNull(get('card_tips'));

  let basis: TipOutBasis | null = null;
  const basisRaw = (get('tip_out_basis') || '').trim().toLowerCase();
  if (basisRaw) {
    if (basisRaw === 'tips' || basisRaw === 'sales') basis = basisRaw;
    else errors.push(`Row ${rowIndex}: tip_out_basis must be "tips" or "sales"`);
  }

  let pct = toNumOrNull(get('tip_out_percent'));
  if (pct != null && (pct < 0 || pct > 100)) {
    errors.push(`Row ${rowIndex}: tip_out_percent out of range 0..100`);
    pct = null;
  }

  const sales = toNumOrNull(get('sales'));
  const tipOverride = toNumOrNull(get('tip_out_override_amount'));
  const wage = toNumOrNull(get('base_hourly_wage'));

  const shift: ShiftInsert = {
    date,
    shift_type: (get('shift_type') || '').trim() || null,
    hours_worked: hours,
    cash_tips: cash,
    card_tips: card,
    tip_out_basis: basis,
    tip_out_percent: pct,
    sales: sales,
    tip_out_override_amount: tipOverride,
    base_hourly_wage: wage,
    notes: (get('notes') ?? '').trim() || null,
  };

  // if basis is sales, sales should be present
  if (shift.tip_out_basis === 'sales' && (shift.sales == null || !(shift.sales >= 0))) {
    errors.push(`Row ${rowIndex}: tip_out_basis is "sales" but sales is missing/invalid`);
    return null;
  }

  return shift;
}

export function parseCsv(text: string): ParseResult {
  const errors: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length === 0 || toLowerNoSpace(lines[0]) === '') {
    return { rows: [], errors: ['Empty CSV'], header: [], skipped: 0 };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) => toLowerNoSpace(h));
  const header: string[] = headerCells;
  const indices: (keyof ShiftInsert | null)[] = headerCells.map((h) => HEADER_MAP[h] ?? null);

  // Minimal required columns
  if (!headerCells.includes('date') || !headerCells.includes('hours_worked')) {
    errors.push('Missing required columns: date, hours_worked');
  }

  const rows: ShiftInsert[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // skip blank lines
    const cells = splitCsvLine(line);

    const raw: Record<string, string> = {} as any;
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      raw[key] = cells[c] ?? '';
    }

    // Reduce to fields we care about using HEADER_MAP keys
    const projected: Record<string, string> = {} as any;
    for (let c = 0; c < header.length; c++) {
      const originalKey = header[c];
      const mapped = HEADER_MAP[originalKey];
      if (mapped) projected[mapped] = raw[originalKey];
    }

    const shift = normalize(projected, i + 1, errors); // human row index (1-based header)
    if (shift) rows.push(shift); else skipped++;
  }

  return { rows, errors, header, skipped };
}

export async function importCsv(opts: { mode: 'append' | 'replace'; rows: ShiftInsert[] }) {
  const { mode, rows } = opts;
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0 };

  if (mode === 'replace') {
    try { await deleteAllShifts(); } catch (e) { /* ignore for web stub */ }
  }

  let inserted = 0;
  for (const r of rows) {
    try {
      await insertShift(r as any);
      inserted++;
    } catch (e) {
      // continue on error
      // eslint-disable-next-line no-console
      console.warn('importCsv insert failed:', e);
    }
  }
  return { inserted };
}