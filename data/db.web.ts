// data/db.web.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'shifts_v1';

async function readAll() {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

async function writeAll(rows) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export async function initDB() {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing === null) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export async function insertShift(row) {
  const rows = await readAll();
  const id = uuidv4();
  rows.push({ id, ...row });
  await writeAll(rows);
  return id;
}

export async function getShifts() {
  const rows = await readAll();
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function updateShift(id, fields) {
  const rows = await readAll();
  const i = rows.findIndex(r => r.id === id);
  if (i === -1) return;
  rows[i] = { ...rows[i], ...fields };
  await writeAll(rows);
}

export async function deleteShift(id) {
  const rows = await readAll();
  await writeAll(rows.filter(r => r.id !== id));
}

export async function deleteAllShifts() {
  await writeAll([]);
}

export async function seedSampleData() {
  const sample = [
    {
      date: '2025-07-21', shift_type: 'Dinner', hours_worked: 6,
      cash_tips: 120, card_tips: 280, tip_out_basis: 'tips', tip_out_percent: 5,
      sales: null, tip_out_override_amount: null, base_hourly_wage: 5, notes: null,
    },
    {
      date: '2025-07-27', shift_type: 'Brunch', hours_worked: 5,
      cash_tips: 90, card_tips: 110, tip_out_basis: 'sales', tip_out_percent: 1.5,
      sales: 1000, tip_out_override_amount: null, base_hourly_wage: 5, notes: 'slow brunch',
    },
    {
      date: '2025-08-02', shift_type: 'Dinner', hours_worked: 7.5,
      cash_tips: 200, card_tips: 300, tip_out_basis: 'tips', tip_out_percent: 3,
      sales: null, tip_out_override_amount: null, base_hourly_wage: 5, notes: 'busy patio',
    },
  ];
  await writeAll([]); // clear
  for (const row of sample) await insertShift(row);
}

export async function getShiftById(id) {
  const rows = await getShifts(); // web: fine; native: you can also do SELECT WHERE id = ?
  return rows.find(r => r.id === id) || null;
}