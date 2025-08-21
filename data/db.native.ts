// data/db.native.ts (Expo new SQLite API)
import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

type ShiftRow = {
  id?: string;
  date: string;
  shift_type: 'Brunch' | 'Lunch' | 'Dinner' | string;
  hours_worked: number;
  cash_tips: number;
  card_tips: number;
  tip_out_basis: 'tips' | 'sales';
  tip_out_percent: number;
  sales: number | null;
  tip_out_override_amount: number | null;
  base_hourly_wage: number;
  notes: string | null;
};

const db = SQLite.openDatabaseSync('tips.db');

// 1) init
export async function initDB() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      date TEXT,
      shift_type TEXT,
      hours_worked REAL,
      cash_tips REAL,
      card_tips REAL,
      tip_out_basis TEXT,
      tip_out_percent REAL,
      sales REAL,
      tip_out_override_amount REAL,
      base_hourly_wage REAL,
      notes TEXT
    )
  `);
}

// 2) CRUD helpers
export async function insertShift(row: ShiftRow) {
  const id = row.id ?? uuidv4();
  await db.runAsync(
    `INSERT INTO shifts (
      id, date, shift_type, hours_worked, cash_tips, card_tips,
      tip_out_basis, tip_out_percent, sales, tip_out_override_amount,
      base_hourly_wage, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      row.date,
      row.shift_type,
      row.hours_worked,
      row.cash_tips,
      row.card_tips,
      row.tip_out_basis,
      row.tip_out_percent,
      row.sales ?? null,
      row.tip_out_override_amount ?? null,
      row.base_hourly_wage,
      row.notes ?? null,
    ]
  );
  return id;
}

export async function getShifts() {
  const rows = await db.getAllAsync<ShiftRow>('SELECT * FROM shifts ORDER BY date DESC');
  return rows;
}

export async function getShiftById(id: string) {
  const row = await db.getFirstAsync<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [id]);
  return row ?? null;
}

export async function updateShift(id: string, row: ShiftRow) {
  await db.runAsync(
    `UPDATE shifts SET
      date=?, shift_type=?, hours_worked=?, cash_tips=?, card_tips=?,
      tip_out_basis=?, tip_out_percent=?, sales=?, tip_out_override_amount=?,
      base_hourly_wage=?, notes=?
     WHERE id=?`,
    [
      row.date,
      row.shift_type,
      row.hours_worked,
      row.cash_tips,
      row.card_tips,
      row.tip_out_basis,
      row.tip_out_percent,
      row.sales ?? null,
      row.tip_out_override_amount ?? null,
      row.base_hourly_wage,
      row.notes ?? null,
      id,
    ]
  );
}

export async function deleteShift(id: string) {
  await db.runAsync('DELETE FROM shifts WHERE id = ?', [id]);
}

export async function wipeAll() {
  await db.execAsync('DELETE FROM shifts');
}

// (Optional) seed for quick testing
export async function seedSample() {
  await insertShift({
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
  });
}