// data/db.web.js
export async function initDB() {
  console.warn('[DB:web] SQLite disabled on web. Skipping init.');
}
export async function insertShift() {
  throw new Error('[DB:web] insertShift not available on web.');
}
export async function getShifts() {
  console.warn('[DB:web] Returning empty array on web.');
  return [];
}
export async function updateShift() {
  throw new Error('[DB:web] updateShift not available on web.');
}
export async function deleteShift() {
  throw new Error('[DB:web] deleteShift not available on web.');
}
export async function deleteAllShifts() {
  console.warn('[DB:web] deleteAllShifts noop.');
}