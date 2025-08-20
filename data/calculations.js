// data/calculations.js
export function computeTipOut({ cash_tips, card_tips, tip_out_basis, tip_out_percent, sales, tip_out_override_amount }) {
  if (tip_out_override_amount != null && tip_out_override_amount !== '') {
    const v = Number(tip_out_override_amount) || 0;
    return round2(Math.max(v, 0));
  }
  const tipsBase = (Number(cash_tips) || 0) + (Number(card_tips) || 0);
  const pct = (Number(tip_out_percent) || 0) / 100;
  const base = tip_out_basis === 'sales' ? (Number(sales) || 0) : tipsBase;
  return round2(base * pct);
}

export function computeDerived({ hours_worked, cash_tips, card_tips, base_hourly_wage, tip_out }) {
  const tipsBase = (Number(cash_tips) || 0) + (Number(card_tips) || 0);
  const net_tips = round2(tipsBase - (Number(tip_out) || 0));
  const wages_earned = round2((Number(base_hourly_wage) || 0) * (Number(hours_worked) || 0));
  const shift_gross = round2(net_tips + wages_earned);
  const hours = Number(hours_worked) || 0;
  const hourly_tips = hours > 0 ? round2(net_tips / hours) : 0;
  const effective_hourly = hours > 0 ? round2(shift_gross / hours) : 0;
  return { net_tips, wages_earned, shift_gross, hourly_tips, effective_hourly };
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;