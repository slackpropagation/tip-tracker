

// data/csv.web.ts
// Web-only CSV export helper: pulls shifts from DB, computes metrics, and downloads a CSV.

import { getShifts } from './db';
import { computeShiftMetrics } from './calculations';

// Minimal shape we rely on from the DB layer
type ShiftRow = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  shift_type: string | null;
  hours_worked: number;
  cash_tips: number | null;
  card_tips: number | null;
  tip_out_basis: 'tips' | 'sales' | null;
  tip_out_percent: number | null; // percent (e.g. 3 for 3%)
  sales: number | null;
  tip_out_override_amount: number | null;
  base_hourly_wage: number | null;
  notes: string | null;
};

const HEADERS = [
  'id','date','shift_type','hours_worked','cash_tips','card_tips','tip_out_basis','tip_out_percent','sales','tip_out_override_amount','base_hourly_wage','notes',
  'computed_tip_out','computed_net_tips','computed_wages_earned','computed_effective_hourly','computed_shift_gross'
];

function esc(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildCsv(rows: ShiftRow[]): string {
  const lines: string[] = [HEADERS.join(',')];
  for (const r of rows) {
    const m = computeShiftMetrics({
      hours_worked: r.hours_worked,
      cash_tips: r.cash_tips ?? 0,
      card_tips: r.card_tips ?? 0,
      base_hourly_wage: r.base_hourly_wage ?? 0,
      tip_out_basis: (r.tip_out_basis as any) ?? 'tips',
      tip_out_percent: r.tip_out_percent ?? 0,
      sales: r.sales ?? undefined,
      tip_out_override_amount: r.tip_out_override_amount ?? undefined,
    });

    const vals = [
      r.id,
      r.date,
      r.shift_type ?? '',
      r.hours_worked,
      r.cash_tips ?? '',
      r.card_tips ?? '',
      r.tip_out_basis ?? '',
      r.tip_out_percent ?? '',
      r.sales ?? '',
      r.tip_out_override_amount ?? '',
      r.base_hourly_wage ?? '',
      r.notes ?? '',
      m.tip_out,
      m.net_tips,
      m.wages_earned,
      m.effective_hourly,
      m.shift_gross,
    ].map(esc);

    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fetch shifts from the DB, build CSV (raw + computed), and start a download in the browser.
 * @param filename Optional filename, defaults to `tip-tracker.csv`.
 */
export async function exportCsv(filename = 'tip-tracker.csv') {
  const rows = await getShifts();
  const csv = buildCsv(rows as ShiftRow[]);
  if (typeof window !== 'undefined') {
    download(filename, csv);
  }
  return csv; // also return the CSV string for testing
}