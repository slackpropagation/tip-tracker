// app/(tabs)/insights.tsx (native: iOS/Android)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { getShifts } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';
import type { RangeKey, ShiftKey } from '../../components/FilterBar';
import { EmptyState } from '../../components/EmptyState';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FBraw = require('../../components/FilterBar');
const FilterBarComp = (FBraw && (FBraw.FilterBar || FBraw.default?.FilterBar || FBraw.default)) as
  | ((props: { range: RangeKey; setRange: (v: RangeKey) => void; shift: ShiftKey; setShift: (v: ShiftKey) => void }) => JSX.Element)
  | undefined;

// Lazy-load victory-native to avoid undefined component issues during module init
type VictoryMod = typeof import('victory-native');
const useVictory = () => {
  const [mod, setMod] = useState<VictoryMod | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const m = await import('victory-native');
      if (mounted) setMod(m);
    })();
    return () => { mounted = false; };
  }, []);
  return mod;
};

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
  const days = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return range === '7d' ? days <= 7 : days <= 30;
}

function isShiftMatch(type: string | null | undefined, want: ShiftKey) {
  if (want === 'all') return true;
  return (type || '') === want;
}

function formatDateLabel(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

type StartOfWeek = 'sun' | 'mon';

function getStartOfWeekSetting(): StartOfWeek {
  // Try extensionless settings (native later), fall back to web, else default 'sun'
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S = require('../../data/settings');
    const val = (S.get && S.get('startOfWeek')) || (S.getAll && S.getAll().startOfWeek);
    return (val === 'mon' ? 'mon' : 'sun');
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sweb = require('../../data/settings.web');
    const val = (Sweb.get && Sweb.get('startOfWeek')) || (Sweb.getAll && Sweb.getAll().startOfWeek);
    return (val === 'mon' ? 'mon' : 'sun');
  } catch {}
  return 'sun';
}

function startOfWeek(date: Date, sow: StartOfWeek): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const offset = sow === 'sun' ? day : (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function InsightsScreen() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [shift, setShift] = useState<ShiftKey>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const V = useVictory();

  const sow = getStartOfWeekSetting();
  const thisWeekStartKey = startOfWeek(new Date(), sow).toDateString();

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
  useFocusEffect(
    useCallback(() => {
      load(); // refresh when tab/screen gains focus
    }, [load])
  );

  const filtered = useMemo(
    () => {
      const result = rows
        .filter(r => isInRange(r.date, range))
        .filter(r => isShiftMatch(r.shift_type, shift));
      return result;
    },
    [rows, range, shift, loading]
  );

  const metrics = useMemo(() => {
    if (filtered.length === 0) {
      return {
        count: 0, hours: 0, tipsBase: 0, tipOut: 0, netTips: 0, wages: 0, gross: 0, avgEffHourly: 0,
        bestShiftType: null as null | { type: string; eff: number },
        bestDow: null as null | { dow: string; eff: number },
        thisWeekGross: 0,
      };
    }

    let count = 0, hours = 0, tipsBase = 0, tipOutSum = 0, netTips = 0, wages = 0, gross = 0;
    let thisWeekGross = 0;
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

      const rWeekKey = startOfWeek(new Date(r.date), sow).toDateString();
      if (rWeekKey === thisWeekStartKey) {
        thisWeekGross += m.shift_gross;
      }

      const eff = m.effective_hourly;
      const t = r.shift_type || 'Unknown';
      byType[t] = byType[t] || { effSum: 0, hSum: 0 };
      byType[t].effSum += eff * (r.hours_worked || 0);
      byType[t].hSum += (r.hours_worked || 0);

      const d = new Date(r.date);
      const dow = d.getDay();
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
      thisWeekGross: +thisWeekGross.toFixed(2),
    };
  }, [filtered, sow, thisWeekStartKey]);

  const dailySeries = useMemo(() => {
    const byDate = new Map<string, { eff: number; tips: number }>();
    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const r of sorted) {
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
      const baseTips = (r.cash_tips || 0) + (r.card_tips || 0);
      const prev = byDate.get(r.date) || { eff: 0, tips: 0 };
      const merged = { eff: prev.eff ? (prev.eff + m.effective_hourly) / 2 : m.effective_hourly, tips: prev.tips + baseTips };
      byDate.set(r.date, merged);
    }
    return Array.from(byDate.entries()).map(([date, v]) => ({
      x: formatDateLabel(new Date(date)), eff: Number(v.eff.toFixed(2)), tips: Number(v.tips.toFixed(2)),
    }));
  }, [filtered]);

  const weeklySeries = useMemo(() => {
    // Group by week start (aligned to StartOfWeek setting)
    type Bucket = { hours: number; gross: number; tips: number };
    const byWeek = new Map<string, Bucket & { start: Date }>();
    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    for (const r of sorted) {
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
      const weekStart = startOfWeek(new Date(r.date), sow);
      const key = weekStart.toISOString().slice(0, 10);
      const prev = byWeek.get(key) || { start: weekStart, hours: 0, gross: 0, tips: 0 };
      prev.hours += r.hours_worked || 0;
      prev.gross += m.shift_gross;
      prev.tips += (r.cash_tips || 0) + (r.card_tips || 0);
      byWeek.set(key, prev);
    }

    const rows = Array.from(byWeek.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((b) => ({
        x: formatDateLabel(b.start),
        eff: b.hours > 0 ? Number((b.gross / b.hours).toFixed(2)) : 0,
        tips: Number(b.tips.toFixed(2)),
      }));
    return rows;
  }, [filtered, sow]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Insights</Text>

      {/* Empty state for no data */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon="📈"
          title="No insights yet"
          subtitle={
            rows.length === 0 
              ? "Add some shifts to see your earning insights and trends."
              : "No shifts match your current filters. Try adjusting the date range or shift type."
          }
          tipTitle="💡 What you'll see"
          tipText="Track your best days, shift types, and earning trends over time!"
          iconBgColor="#fff3cd"
          iconColor="#856404"
        />
      )}

      {/* Show filters and metrics/charts only when there's data */}
      {filtered.length > 0 && (
        <>
          {FilterBarComp ? (
            <FilterBarComp range={range} setRange={setRange} shift={shift} setShift={setShift} />
          ) : (
            <View style={{ padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8 }}>
              <Text>Loading filters…</Text>
            </View>
          )}

          {/* Show metrics and charts only when there's data */}
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
            <Card title="This week gross" value={`$${metrics.thisWeekGross.toFixed(2)}`} subtitle={sow === 'mon' ? 'Week starts Mon' : 'Week starts Sun'} />
          </View>

          { !V ? (
              <View style={{ padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8 }}>
                <Text>Loading charts…</Text>
              </View>
            ) : null }

          {V && (
            <>
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Effective $/hr by day</Text>
            <V.VictoryChart domainPadding={{ x: 16, y: 12 }}>
              <V.VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10, angle: 0 } }} />
              <V.VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryLine data={dailySeries} x="x" y="eff" interpolation="monotoneX" />
            </V.VictoryChart>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Daily tips (cash + card)</Text>
            <V.VictoryChart domainPadding={{ x: 16, y: 12 }}>
              <V.VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryGroup>
                <V.VictoryBar data={dailySeries} x="x" y="tips" />
              </V.VictoryGroup>
            </V.VictoryChart>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly avg effective $/hr</Text>
            <V.VictoryChart domainPadding={{ x: 16, y: 12 }}>
              <V.VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryLine data={weeklySeries} x="x" y="eff" interpolation="monotoneX" />
            </V.VictoryChart>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly tips total (cash + card)</Text>
            <V.VictoryChart domainPadding={{ x: 16, y: 12 }}>
              <V.VictoryAxis tickFormat={(t: string) => t} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryAxis dependentAxis tickFormat={(t: number) => `$${t}`} style={{ tickLabels: { fontSize: 10 } }} />
              <V.VictoryGroup>
                <V.VictoryBar data={weeklySeries} x="x" y="tips" />
              </V.VictoryGroup>
            </V.VictoryChart>
          </View>
          </>
          )}
        </>
      )}
    </ScrollView>
  );
}