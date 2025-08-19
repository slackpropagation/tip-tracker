import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

type Basis = 'tips' | 'sales';

export type ShiftRow = {
  id: string;
  date: string;                 // YYYY-MM-DD
  shift_type: 'Brunch' | 'Lunch' | 'Dinner';
  hours_worked: number;
  cash_tips: number;
  card_tips: number;
  tip_out_basis: Basis;         // 'tips' | 'sales'
  tip_out_percent: number;      // 0..100
  sales: number | null;         // required if basis='sales'
  tip_out_override_amount: number | null; // optional
  base_hourly_wage: number;     // user-entered
  notes: string | null;
};

const db = SQLite.openDatabase('tips.db');

function run<T = SQLite.SQLResultSet>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_tx, res) => resolve(res as unknown as T),
        (_tx, err) => {
          reject(err);
          return true;
        }
      );
    });
  });
}

export async function initDB() {
  await run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      hours_worked REAL NOT NULL,
      cash_tips REAL NOT NULL,
      card_tips REAL NOT NULL,
      tip_out_basis TEXT NOT NULL,
      tip_out_percent REAL NOT NULL,
      sales REAL,
      tip_out_override_amount REAL,
      base_hourly_wage REAL NOT NULL,
      notes TEXT
    );
  `);
}

export async function insertShift(partial: Omit<ShiftRow, 'id'>) {
  const id = uuidv4();
  await run(
    `INSERT INTO shifts
     (id, date, shift_type, hours_worked, cash_tips, card_tips, tip_out_basis, tip_out_percent, sales, tip_out_override_amount, base_hourly_wage, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      partial.date,
      partial.shift_type,
      partial.hours_worked,
      partial.cash_tips,
      partial.card_tips,
      partial.tip_out_basis,
      partial.tip_out_percent,
      partial.sales ?? null,
      partial.tip_out_override_amount ?? null,
      partial.base_hourly_wage,
      partial.notes ?? null,
    ]
  );
  return id;
}

export async function getShifts(): Promise<ShiftRow[]> {
  const res = await run<SQLite.SQLResultSet>(`SELECT * FROM shifts ORDER BY date DESC`);
  const rows = (res.rows as any)._array as ShiftRow[];
  return rows ?? [];
}

export async function updateShift(id: string, fields: Partial<Omit<ShiftRow, 'id'>>) {
  // Build dynamic SET clause
  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const params = entries.map(([, v]) => (v === undefined ? null : (v as any)));
  params.push(id);

  await run(
    `UPDATE shifts SET ${setClause} WHERE id = ?`,
    params as (string | number | null)[]
  );
}

export async function deleteShift(id: string) {
  await run(`DELETE FROM shifts WHERE id = ?`, [id]);
}

/** Utility to wipe everything (handy in development). */
export async function deleteAllShifts() {
  await run(`DELETE FROM shifts`);
}

/** Seed a few rows so you can see data immediately. */
export async function seedSampleData() {
  const sample: Omit<ShiftRow, 'id'>[] = [
    {
      date: '2025-07-21',
      shift_type: 'Dinner',
      hours_worked: 6,
      cash_tips: 120,
      card_tips: 280,
      tip_out_basis: 'tips',
      tip_out_percent: 5,
      sales: null,
      tip_out_override_amount: null,
      base_hourly_wage: 5,
      notes: null,
    },
    {
      date: '2025-07-27',
      shift_type: 'Brunch',
      hours_worked: 5,
      cash_tips: 90,
      card_tips: 110,
      tip_out_basis: 'sales',
      tip_out_percent: 1.5,
      sales: 1000,
      tip_out_override_amount: null,
      base_hourly_wage: 5,
      notes: 'slow brunch',
    },
    {
      date: '2025-08-02',
      shift_type: 'Dinner',
      hours_worked: 7.5,
      cash_tips: 200,
      card_tips: 300,
      tip_out_basis: 'tips',
      tip_out_percent: 3,
      sales: null,
      tip_out_override_amount: null,
      base_hourly_wage: 5,
      notes: 'busy patio',
    },
  ];

  for (const row of sample) {
    await insertShift(row);
  }
}