// data/calculations.js
const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(',', '.');          // 5,0 -> 5.0
  s = s.replace(/[^0-9.\-]/g, '');  // strip $, spaces, thousands
  if (s.endsWith('.')) s = s.slice(0, -1); // "5." -> "5"
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n) => Math.round(toNum(n) * 100) / 100;

export function computeTipOut({ cash_tips, card_tips, tip_out_basis, tip_out_percent, sales, tip_out_override_amount }) {
  if (tip_out_override_amount !== null && tip_out_override_amount !== undefined && String(tip_out_override_amount).trim() !== '') {
    return round2(toNum(tip_out_override_amount));
  }
  const tipsBase = toNum(cash_tips) + toNum(card_tips);
  const pct = toNum(tip_out_percent) / 100;
  const base = tip_out_basis === 'sales' ? toNum(sales) : tipsBase;
  return round2(base * pct);
}

export function computeDerived({ hours_worked, cash_tips, card_tips, base_hourly_wage, tip_out }) {
  const tipsBase = toNum(cash_tips) + toNum(card_tips);
  const tipOut   = toNum(tip_out);
  const net_tips = round2(tipsBase - tipOut);
  const wages_earned = round2(toNum(base_hourly_wage) * toNum(hours_worked));
  const gross = round2(net_tips + wages_earned);
  const h = toNum(hours_worked);
  const hourly_tips = h > 0 ? round2(net_tips / h) : 0;
  const effective_hourly = h > 0 ? round2(gross / h) : 0;
  return { net_tips, wages_earned, shift_gross: gross, hourly_tips, effective_hourly };
}

export function computeShiftMetrics(raw) {
  // Normalize once
  const hours = toNum(raw.hours_worked);
  const cash = toNum(raw.cash_tips);
  const card = toNum(raw.card_tips);
  const baseWage = toNum(raw.base_hourly_wage);
  const basis = raw.tip_out_basis; // 'tips' | 'sales'
  const pct = toNum(raw.tip_out_percent);
  const sales = toNum(raw.sales);
  const overrideAmt = (raw.tip_out_override_amount ?? '') + '';

  const tipsBase = cash + card;

  let tip_out;
  if (overrideAmt.trim() !== '') {
    tip_out = round2(toNum(overrideAmt));
  } else {
    const base = basis === 'sales' ? sales : tipsBase;
    tip_out = round2(base * (pct / 100));
  }

  const net_tips = round2(tipsBase - tip_out);
  const wages_earned = round2(baseWage * hours);
  const shift_gross = round2(net_tips + wages_earned);
  const hourly_tips = hours > 0 ? round2(net_tips / hours) : 0;
  const effective_hourly = hours > 0 ? round2(shift_gross / hours) : 0;

  return {
    // inputs (parsed) for debugging
    _parsed: { hours, cash, card, baseWage, basis, pct, sales, overrideAmt: overrideAmt.trim() },
    // intermediates
    tips_base: tipsBase,
    tip_out,
    // results
    net_tips,
    wages_earned,
    shift_gross,
    hourly_tips,
    effective_hourly,
  };
}