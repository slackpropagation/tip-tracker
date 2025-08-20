// app/(tabs)/insights.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { getShifts } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';

type RangeKey = '7d' | '30d' | 'all';

const Card = ({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) => (
  <View style={{ padding: 14, borderWidth: 1, borderColor: '#eee', borderRadius: 10, minWidth: 140, flex: 1 }}>
    <Text style={{ fontSize: 12, color: '#666' }}>{title}</Text>
    <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6 }}>{value}</Text>
    {subtitle ? <Text style={{ marginTop: 4, color: '#777' }}>{subtitle}</Text> : null}
  </View>
);

function isInRange(dateStr: string, range: RangeKey) {
  if (range === 'all') return true;
  const today = new Date();
  const d = new Date(dateStr);
  const ms = today.getTime() - d.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return range === '7d' ? days <= 7 : days <= 30;
}

export default function InsightsScreen() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getShifts();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => isInRange(r.date, range)), [rows, range]);

  const metrics = useMemo(() => {
    if (filtered.length === 0) {
      return {
        count: 0,
        hours: 0,
        tipsBase: 0,
        tipOut: 0,
        netTips: 0,
        wages: 0,
        gross: 0,
        avgEffHourly: 0,
        bestShiftType: null as null | { type: string; eff: number },
        bestDow: null as null | { dow: string; eff: number },
      };
    }

    let count = 0;
    let hours = 0;
    let tipsBase = 0;
    let tipOutSum = 0;
    let netTips = 0;
    let wages = 0;
    let gross = 0;

    const byType: Record<string, { effSum: number; hSum: number }> = {};
    const byDow: Record<number, { effSum: number; hSum: number }> = {};

    for (const r of filtered) {
      const m = computeShiftMetrics({
        hours_worked: r.hours_worked,
        cash_tips: r.cash_tips,
        card_tips: r.card_tips,
        base_hourly_wage: r.base_hourly_wage,
        tip_out_basis: r.tip_out_basis,
        tip_out_percent: r.tip_out_percent,
        sales: r.sales,
        tip_out_override_amount: r.tip_out_override_amount,
      });

      count += 1;
      hours += r.hours_worked || 0;
      const base = (r.cash_tips || 0) + (r.card_tips || 0);
      tipsBase += base;
      tipOutSum += m.tip_out;
      netTips += m.net_tips;
      wages += m.wages_earned;
      gross += m.shift_gross;

      // shift type eff/hr (weighted by hours)
      const eff = m.effective_hourly;
      const t = r.shift_type || 'Unknown';
      byType[t] = byType[t] || { effSum: 0, hSum: 0 };
      byType[t].effSum += eff * (r.hours_worked || 0);
      byType[t].hSum += (r.hours_worked || 0);

      // day-of-week eff/hr (weighted by hours)
      const d = new Date(r.date);
      const dow = d.getDay(); // 0-6
      byDow[dow] = byDow[dow] || { effSum: 0, hSum: 0 };
      byDow[dow].effSum += eff * (r.hours_worked || 0);
      byDow[dow].hSum += (r.hours_worked || 0);
    }

    const avgEffHourly = hours > 0 ? +(gross / hours).toFixed(2) : 0;

    const bestShiftType = Object.entries(byType)
      .map(([type, v]) => ({ type, eff: v.hSum > 0 ? v.effSum / v.hSum : 0 }))
      .sort((a, b) => b.eff - a.eff)[0] || null;

    const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const bestDowEntry = Object.entries(byDow)
      .map(([k, v]) => ({ dow: dowNames[Number(k)], eff: v.hSum > 0 ? v.effSum / v.hSum : 0 }))
      .sort((a, b) => b.eff - a.eff)[0] || null;

    return {
      count,
      hours: +hours.toFixed(2),
      tipsBase: +tipsBase.toFixed(2),
      tipOut: +tipOutSum.toFixed(2),
      netTips: +netTips.toFixed(2),
      wages: +wages.toFixed(2),
      gross: +gross.toFixed(2),
      avgEffHourly,
      bestShiftType,
      bestDow: bestDowEntry,
    };
  }, [filtered]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Insights</Text>

      {/* Range selector */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['7d', '30d', 'all'] as RangeKey[]).map(key => (
          <Pressable
            key={key}
            onPress={() => setRange(key)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: range === key ? '#2f95dc' : '#f0f0f0'
            }}
          >
            <Text style={{ color: range === key ? 'white' : 'black' }}>
              {key === '7d' ? 'Last 7 days' : key === '30d' ? 'Last 30 days' : 'All time'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* KPI rows */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card title="Shifts" value={String(metrics.count)} />
        <Card title="Hours" value={String(metrics.hours)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card title="Total tips" value={`$${metrics.tipsBase.toFixed(2)}`} subtitle="Cash + Card" />
        <Card title="Tip-out total" value={`$${metrics.tipOut.toFixed(2)}`} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card title="Net tips" value={`$${metrics.netTips.toFixed(2)}`} />
        <Card title="Wages" value={`$${metrics.wages.toFixed(2)}`} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card title="Gross" value={`$${metrics.gross.toFixed(2)}`} />
        <Card title="Avg eff/hr" value={`$${metrics.avgEffHourly.toFixed(2)}`} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card
          title="Best shift type"
          value={metrics.bestShiftType ? `${metrics.bestShiftType.type}` : '—'}
          subtitle={metrics.bestShiftType ? `$${metrics.bestShiftType.eff.toFixed(2)}/hr` : undefined}
        />
        <Card
          title="Best day"
          value={metrics.bestDow ? metrics.bestDow.dow : '—'}
          subtitle={metrics.bestDow ? `$${metrics.bestDow.eff.toFixed(2)}/hr` : undefined}
        />
      </View>

      {/* (Step 10: we will add charts here) */}
    </ScrollView>
  );
}