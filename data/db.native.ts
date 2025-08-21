// data/db.native.js
import * as SQLite from 'expo-sqlite/legacy';
import { v4 as uuidv4 } from 'uuid';

const db = SQLite.openDatabase('tips.db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_tx, res) => resolve(res),
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
      tip_out_basis TEXT NOT NULL,          -- 'tips' | 'sales'
      tip_out_percent REAL NOT NULL,        -- 0..100
      sales REAL,                           -- required if basis='sales'
      tip_out_override_amount REAL,         -- optional override
      base_hourly_wage REAL NOT NULL,
      notes TEXT
    );
  `);
}

export async function insertShift(row) {
  const id = uuidv4();
  await run(
    `INSERT INTO shifts
     (id, date, shift_type, hours_worked, cash_tips, card_tips, tip_out_basis, tip_out_percent, sales, tip_out_override_amount, base_hourly_wage, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const res = await run(`SELECT * FROM shifts ORDER BY date DESC`);
  return res?.rows?._array ?? [];
}

export async function updateShift(id, fields) {
  const entries = Object.entries(fields || {});
  if (!entries.length) return;

  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const params = entries.map(([, v]) => (v === undefined ? null : v));
  params.push(id);

  await run(`UPDATE shifts SET ${setClause} WHERE id = ?`, params);
}

export async function deleteShift(id) {
  await run(`DELETE FROM shifts WHERE id = ?`, [id]);
}

export async function deleteAllShifts() {
  await run(`DELETE FROM shifts`);
}

export async function getShiftById(id) {
  const rows = await getShifts(); // web: fine; native: you can also do SELECT WHERE id = ?
  return rows.find(r => r.id === id) || null;
}