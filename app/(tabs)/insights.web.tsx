// app/(tabs)/insights.web.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { getShifts } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';
import { FilterBar, RangeKey, ShiftKey } from '../../components/FilterBar';
import { getAll as getAllSettings } from '../../data/settings.web';
import {
  VictoryAxis,
  VictoryBar,
  VictoryBoxPlot,
  VictoryChart,
  VictoryLabel,
  VictoryLegend,
  VictoryScatter,
} from 'victory';

// ---------- small UI helpers ----------
const Card = ({ title, value, subtitle, badge }: {
  title: string; value: string; subtitle?: string; badge?: string
}) => (
  <View style={{ padding: 14, borderWidth: 1, borderColor: '#eee', borderRadius: 10, minWidth: 160, flex: 1 }}>
    <Text style={{ fontSize: 12, color: '#666' }}>{title}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6 }}>{value}</Text>
      {badge ? (
        <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' }}>
          <Text style={{ fontSize: 10, color: '#444' }}>{badge}</Text>
        </View>
      ) : null}
    </View>
    {subtitle ? <Text style={{ marginTop: 4, color: '#777' }}>{subtitle}</Text> : null}
  </View>
);

const WEEKS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;

function isInRange(dateStr: string, range: RangeKey) {
  if (range === 'all') return true;
  const today = new Date();
  const d = new Date(dateStr);
  const days = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return range === '7d' ? days <= 7 : days <= 30;
}
function isShiftMatch(type: string | null | undefined, want: ShiftKey) {
  if (want === 'all') return true;
  return (type || '') === want;
}

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] - sorted[base] || 0) * rest;
}
function confidenceLabel(n: number) {
  if (n >= 8) return 'High';
  if (n >= 3) return 'Medium';
  return 'Low';
}
function currency(n: number) { return `$${n.toFixed(2)}`; }

type StartOfWeek = 'sun' | 'mon';

function startOfWeek(date: Date, sow: StartOfWeek): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const offset = sow === 'sun' ? day : (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

export default function InsightsScreen() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [shift, setShift] = useState<ShiftKey>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const sow: StartOfWeek = (getAllSettings().startOfWeek === 'mon' ? 'mon' : 'sun');

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
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => rows
      .filter(r => isInRange(r.date, range))
      .filter(r => isShiftMatch(r.shift_type, shift)),
    [rows, range, shift]
  );

  // Attach computed metrics to each row
  const withMetrics = useMemo(() => filtered.map(r => ({
    ...r,
    m: computeShiftMetrics({
      hours_worked: r.hours_worked,
      cash_tips: r.cash_tips,
      card_tips: r.card_tips,
      base_hourly_wage: r.base_hourly_wage,
      tip_out_basis: r.tip_out_basis,
      tip_out_percent: r.tip_out_percent,
      sales: r.sales,
      tip_out_override_amount: r.tip_out_override_amount,
    })
  })), [filtered]);

  // KPI summary
  const summary = useMemo(() => {
    if (withMetrics.length === 0) return { count: 0, hours: 0, tips: 0, tipout: 0, net: 0, wages: 0, gross: 0, avgEff: 0 };
    let hours = 0, tips = 0, tipout = 0, net = 0, wages = 0, gross = 0;
    for (const r of withMetrics) {
      const base = (r.cash_tips || 0) + (r.card_tips || 0);
      hours += r.hours_worked || 0;
      tips += base;
      tipout += r.m.tip_out;
      net += r.m.net_tips;
      wages += r.m.wages_earned;
      gross += r.m.shift_gross;
    }
    return { count: withMetrics.length, hours, tips, tipout, net, wages, gross, avgEff: hours > 0 ? gross / hours : 0 };
  }, [withMetrics]);

  // Trend series (effective $/hr & tips by day)
  const dailySeries = useMemo(() => {
    const byDate = new Map<string, { eff: number[]; tips: number }>();
    const sorted = [...withMetrics].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const r of sorted) {
      const baseTips = (r.cash_tips || 0) + (r.card_tips || 0);
      const prev = byDate.get(r.date) || { eff: [], tips: 0 };
      prev.eff.push(r.m.effective_hourly);
      prev.tips += baseTips;
      byDate.set(r.date, prev);
    }
    return Array.from(byDate.entries()).map(([date, v]) => ({
      x: new Date(date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
      eff: +(v.eff.reduce((a, b) => a + b, 0) / v.eff.length).toFixed(2),
      tips: +v.tips.toFixed(2),
    }));
  }, [withMetrics]);

  const weeklySeries = useMemo(() => {
    type Bucket = { hours: number; gross: number; tips: number };
    const byWeek = new Map<string, Bucket & { start: Date }>();
    const sorted = [...withMetrics].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const r of sorted) {
      const weekStart = startOfWeek(new Date(r.date), sow);
      const key = weekStart.toISOString().slice(0, 10);
      const prev = byWeek.get(key) || { start: weekStart, hours: 0, gross: 0, tips: 0 };
      prev.hours += r.hours_worked || 0;
      prev.gross += r.m.shift_gross;
      const baseTips = (r.cash_tips || 0) + (r.card_tips || 0);
      prev.tips += baseTips;
      byWeek.set(key, prev);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(b => ({
        x: formatDateLabel(b.start),
        eff: b.hours > 0 ? Number((b.gross / b.hours).toFixed(2)) : 0,
        tips: Number(b.tips.toFixed(2)),
      }));
  }, [withMetrics, sow]);

  // Heatmap data (weekday x shift_type → avg eff/hr)
  const heatmapData = useMemo(() => {
    const key = (dow: number, type: string) => `${dow}::${type}`;
    const acc = new Map<string, { sum: number; n: number }>();
    const types = new Set<string>();
    for (const r of withMetrics) {
      const d = new Date(r.date).getDay();
      const t = r.shift_type || 'Unknown';
      types.add(t);
      const k = key(d, t);
      const v = acc.get(k) || { sum: 0, n: 0 };
      v.sum += r.m.effective_hourly;
      v.n += 1;
      acc.set(k, v);
    }
    const typeList = Array.from(types.values()).sort();
    const cells = [] as { x: string; y: string; value: number; n: number }[];
    for (const t of typeList) {
      for (let i = 0; i < 7; i++) {
        const v = acc.get(key(i, t));
        const avg = v ? v.sum / v.n : 0;
        cells.push({ x: WEEKS[i], y: t, value: +avg.toFixed(2), n: v?.n ?? 0 });
      }
    }
    return { cells, typeList };
  }, [withMetrics]);

  // Box plot data (per shift_type)
  const boxData = useMemo(() => {
    const byType = new Map<string, number[]>();
    for (const r of withMetrics) {
      const t = r.shift_type || 'Unknown';
      const arr = byType.get(t) || [];
      arr.push(r.m.effective_hourly);
      byType.set(t, arr);
    }
    const rows = Array.from(byType.entries()).map(([t, arr]) => {
      const s = [...arr].sort((a, b) => a - b);
      const min = s[0] ?? 0;
      const q1 = quantile(s, 0.25);
      const med = quantile(s, 0.5);
      const q3 = quantile(s, 0.75);
      const max = s[s.length - 1] ?? 0;
      return { x: t, min, q1, median: med, q3, max, n: s.length };
    }).sort((a, b) => a.x.localeCompare(b.x));
    return rows;
  }, [withMetrics]);

  // Recommendations
  const bests = useMemo(() => {
    if (withMetrics.length === 0) return {
      bestHourly: { label: '—', value: 0, conf: 'Low' as const },
      bestTotal: { label: '—', value: 0, conf: 'Low' as const },
    };
    const grouped: Record<string, { sum: number; n: number }> = {};
    const totalGrouped: Record<string, { sum: number; n: number }> = {};
    for (const r of withMetrics) {
      const key = `${WEEKS[new Date(r.date).getDay()]} ${r.shift_type || 'Unknown'}`;
      (grouped[key] ||= { sum: 0, n: 0 });
      grouped[key].sum += r.m.effective_hourly;
      grouped[key].n += 1;

      (totalGrouped[key] ||= { sum: 0, n: 0 });
      totalGrouped[key].sum += r.m.net_tips + r.m.wages_earned;
      totalGrouped[key].n += 1;
    }
    const bestHourly = Object.entries(grouped)
      .map(([k, v]) => ({ label: k, value: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.value - a.value)[0]!;
    const bestTotal = Object.entries(totalGrouped)
      .map(([k, v]) => ({ label: k, value: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.value - a.value)[0]!;
    return {
      bestHourly: { label: bestHourly.label, value: bestHourly.value, conf: confidenceLabel(bestHourly.n) as 'Low'|'Medium'|'High' },
      bestTotal: { label: bestTotal.label, value: bestTotal.value, conf: confidenceLabel(bestTotal.n) as 'Low'|'Medium'|'High' },
    };
  }, [withMetrics]);

  // ---------- render ----------
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Insights</Text>

      <FilterBar range={range} setRange={setRange} shift={shift} setShift={setShift} />

      {/* KPI rows */}
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Card title="Shifts" value={String(summary.count)} />
        <Card title="Hours" value={summary.hours.toFixed(2)} />
        <Card title="Avg eff/hr" value={currency(summary.avgEff)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Card title="Total tips" value={currency(summary.tips)} subtitle="Cash + Card" />
        <Card title="Tip-out total" value={currency(summary.tipout)} />
        <Card title="Net tips" value={currency(summary.net)} />
        <Card title="Wages" value={currency(summary.wages)} />
        <Card title="Gross" value={currency(summary.gross)} />
      </View>

      {/* Recommendations */}
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Card title="Best hourly slot" value={`${currency(bests.bestHourly.value)} avg`} subtitle={bests.bestHourly.label} badge={bests.bestHourly.conf} />
        <Card title="Best total slot" value={`${currency(bests.bestTotal.value)} avg`} subtitle={bests.bestTotal.label} badge={bests.bestTotal.conf} />
      </View>

      {/* Trend: effective $/hr (bar for readability on web) */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Effective $/hr by day</Text>
        <VictoryChart domainPadding={{ x: 16, y: 12 }}>
          <VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}` } style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryBar data={dailySeries} x="x" y="eff" />
        </VictoryChart>
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly avg effective $/hr</Text>
        <VictoryChart domainPadding={{ x: 16, y: 12 }}>
          <VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}` } style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryBar data={weeklySeries} x="x" y="eff" />
        </VictoryChart>
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly tips total (cash + card)</Text>
        <VictoryChart domainPadding={{ x: 16, y: 12 }}>
          <VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}` } style={{ tickLabels: { fontSize: 10 } }} />
          <VictoryBar data={weeklySeries} x="x" y="tips" />
        </VictoryChart>
      </View>

      {/* Heatmap: weekday × shift type (avg eff/hr) using bubble chart */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Heatmap: Avg effective $/hr</Text>
        <VictoryChart domainPadding={{ x: 16, y: 16 }}>
          <VictoryAxis tickValues={WEEKS as unknown as string[]} />
          <VictoryAxis dependentAxis tickFormat={(t: string) => t} />
          <VictoryScatter
            data={heatmapData.cells.map((c) => ({ x: c.x, y: heatmapData.typeList.indexOf(c.y) + 1, value: c.value, n: c.n }))}
            size={({ datum }) => (datum.n ? Math.min(20, 6 + datum.n * 2) : 0)}
            labels={({ datum }) => (datum.value ? `$${datum.value}` : '')}
            labelComponent={<VictoryLabel dy={2} />}
            style={{
              data: {
                fill: ({ datum }) => {
                  const v = datum.value || 0;
                  const clamped = Math.max(0, Math.min(1, v / 60)); // 0–$60/hr
                  const g = Math.round(80 + clamped * 150);
                  return `rgb(40, ${g}, 80)`;
                },
                stroke: '#333',
                strokeWidth: 0.25,
              },
            }}
          />
          <VictoryAxis
            dependentAxis
            tickValues={heatmapData.typeList.map((_, i) => i + 1)}
            tickFormat={(_t, i) => heatmapData.typeList[i]}
            style={{ tickLabels: { fontSize: 10 } }}
          />
          <VictoryLegend x={0} y={0} orientation="horizontal" gutter={12}
            data={[{ name: 'bubble size = samples' }, { name: 'color = avg $/hr' }]} />
        </VictoryChart>
      </View>

      {/* Box plots per shift type */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Distribution by shift type (effective $/hr)</Text>
        <VictoryChart domainPadding={{ x: 24, y: 12 }}>
          <VictoryAxis />
          <VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}` } />
          <VictoryBoxPlot
            boxWidth={18}
            data={boxData}
            x="x"
            min={(d: any) => d.min}
            q1={(d: any) => d.q1}
            median={(d: any) => d.median}
            q3={(d: any) => d.q3}
            max={(d: any) => d.max}
            labels={(d: any) => `${d.datum.n} samples`}
            style={{ labels: { fontSize: 9 } }}
          />
        </VictoryChart>
      </View>
    </ScrollView>
  );
}