// app/(tabs)/insights.tsx (native: iOS/Android)
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import type { RangeKey, ShiftKey } from '../../components/FilterBar';
import { computeShiftMetrics } from '../../data/calculations';
import { getShifts } from '../../data/db';
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

  // Day × Shift heatmap data
  const heatmapData = useMemo(() => {
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shiftTypes = ['Brunch', 'Lunch', 'Dinner'];
    
    // Initialize heatmap matrix
    const matrix: Record<string, Record<string, { 
      avgEffHourly: number; 
      totalShifts: number; 
      totalHours: number;
      confidence: 'Low' | 'Medium' | 'High';
    }>> = {};
    
    // Initialize all combinations
    dowNames.forEach(dow => {
      matrix[dow] = {};
      shiftTypes.forEach(shift => {
        matrix[dow][shift] = { avgEffHourly: 0, totalShifts: 0, totalHours: 0, confidence: 'Low' };
      });
    });
    
    // Group shifts by day of week and shift type
    const grouped: Record<string, Record<string, number[]>> = {};
    
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
      
      const d = new Date(r.date);
      const dow = dowNames[d.getDay()];
      const shiftType = r.shift_type || 'Unknown';
      
      if (!grouped[dow]) grouped[dow] = {};
      if (!grouped[dow][shiftType]) grouped[dow][shiftType] = [];
      grouped[dow][shiftType].push(m.effective_hourly);
    }
    
    // Calculate averages and confidence levels
    Object.entries(grouped).forEach(([dow, shifts]) => {
      Object.entries(shifts).forEach(([shiftType, hourlyRates]) => {
        if (hourlyRates.length > 0) {
          const totalShifts = hourlyRates.length;
          const totalHours = hourlyRates.reduce((sum, rate) => sum + rate, 0);
          const avgEffHourly = totalHours / totalShifts;
          
          // Determine confidence level based on sample size
          let confidence: 'Low' | 'Medium' | 'High' = 'Low';
          if (totalShifts >= 8) confidence = 'High';
          else if (totalShifts >= 3) confidence = 'Medium';
          
          matrix[dow][shiftType] = {
            avgEffHourly: Number(avgEffHourly.toFixed(2)),
            totalShifts,
            totalHours: Number(totalHours.toFixed(2)),
            confidence
          };
        }
      });
    });
    
    return matrix;
  }, [filtered]);

  // Recommendation data with confidence
  const recommendations = useMemo(() => {
    const recs: Array<{
      type: 'bestTime' | 'bestShift' | 'avoidTime' | 'avoidShift';
      title: string;
      description: string;
      confidence: 'Low' | 'Medium' | 'High';
      value: string;
    }> = [];
    
    // Find best day of week
    if (metrics.bestDow) {
      recs.push({
        type: 'bestTime',
        title: 'Best Day to Work',
        description: `${metrics.bestDow.dow} shifts earn the most`,
        confidence: metrics.count >= 8 ? 'High' : metrics.count >= 3 ? 'Medium' : 'Low',
        value: `${metrics.bestDow.dow} ($${metrics.bestDow.eff.toFixed(2)}/hr)`
      });
    }
    
    // Find best shift type
    if (metrics.bestShiftType) {
      recs.push({
        type: 'bestShift',
        title: 'Most Profitable Shift',
        description: `${metrics.bestShiftType.type} shifts are your best bet`,
        confidence: metrics.count >= 8 ? 'High' : metrics.count >= 3 ? 'Medium' : 'Low',
        value: `${metrics.bestShiftType.type} ($${metrics.bestShiftType.eff.toFixed(2)}/hr)`
      });
    }
    
    // Find worst performing combinations from heatmap
    let worstCombination = { dow: '', shift: '', rate: Infinity };
    Object.entries(heatmapData).forEach(([dow, shifts]) => {
      Object.entries(shifts).forEach(([shift, data]) => {
        if (data.totalShifts > 0 && data.avgEffHourly < worstCombination.rate) {
          worstCombination = { dow, shift, rate: data.avgEffHourly };
        }
      });
    });
    
    if (worstCombination.dow && worstCombination.shift && worstCombination.rate < Infinity) {
      recs.push({
        type: 'avoidTime',
        title: 'Consider Avoiding',
        description: `${worstCombination.dow} ${worstCombination.shift} shifts`,
        confidence: 'Medium',
        value: `$${worstCombination.rate.toFixed(2)}/hr`
      });
    }
    
    return recs;
  }, [metrics, heatmapData]);

  return (
    <>
      {!loading && filtered.length === 0 ? (
        // Use View for empty state to allow proper centering
        <View style={{ flex: 1 }}>
          <View style={{ padding: 16, paddingBottom: 0 }}>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Insights</Text>
          </View>
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
        </View>
      ) : (
        // Use ScrollView for content
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Insights</Text>

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
              {/* Enhanced Daily Earnings Trend */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Daily Earnings Trend</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Your effective hourly rate over time
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 16, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    tickFormat={(t: string) => t} 
                    style={{ 
                      tickLabels: { fontSize: 10, angle: 0, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryLine
                    data={dailySeries}
                    x="x"
                    y="eff"
                    style={{
                      data: {
                        stroke: "#2f95dc",
                        strokeWidth: 4
                      }
                    }}
                    interpolation="monotoneX"
                  />
                  <V.VictoryScatter
                    data={dailySeries}
                    x="x"
                    y="eff"
                    size={5}
                    style={{
                      data: {
                        fill: "#2f95dc",
                        stroke: "white",
                        strokeWidth: 2
                      }
                    }}
                  />
                  <V.VictoryScatter
                    data={dailySeries}
                    x="x"
                    y="eff"
                    size={8}
                    style={{
                      data: {
                        fill: "#2f95dc",
                        fillOpacity: 0.2
                      }
                    }}
                  />
                </V.VictoryChart>
              </View>

              {/* Enhanced Daily Tips Breakdown */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Daily Tips Breakdown</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Cash + Card tips by day
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 16, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    tickFormat={(t: string) => t} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryBar
                    data={dailySeries}
                    x="x"
                    y="tips"
                    style={{
                      data: {
                        fill: "#28a745",
                        stroke: "#28a745",
                        strokeWidth: 1
                      }
                    }}
                    cornerRadius={4}
                  />
                  <defs>
                  </defs>
                </V.VictoryChart>
              </View>

              {/* Enhanced Weekly Performance */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly Performance Overview</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Average effective hourly rate by week
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 16, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    tickFormat={(t: string) => t} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryLine
                    data={weeklySeries}
                    x="x"
                    y="eff"
                    style={{
                      data: {
                        stroke: "#ff6b6b",
                        strokeWidth: 4
                      }
                    }}
                    interpolation="monotoneX"
                  />
                  <V.VictoryScatter
                    data={weeklySeries}
                    x="x"
                    y="eff"
                    size={6}
                    style={{
                      data: {
                        fill: "#ff6b6b",
                        stroke: "white",
                        strokeWidth: 2
                      }
                    }}
                  />
                  <V.VictoryScatter
                    data={weeklySeries}
                    x="x"
                    y="eff"
                    size={10}
                    style={{
                      data: {
                        fill: "#ff6b6b",
                        fillOpacity: 0.2
                      }
                    }}
                  />
                </V.VictoryChart>
              </View>

              {/* Enhanced Weekly Tips Trend */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Weekly Tips Trend</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Total tips earned per week
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 16, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    tickFormat={(t: string) => t} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryBar
                    data={weeklySeries}
                    x="x"
                    y="tips"
                    style={{
                      data: {
                        fill: "#fd7e14",
                        stroke: "#fd7e14",
                        strokeWidth: 3
                      }
                    }}
                    cornerRadius={4}
                  />
                  <defs>
                  </defs>
                </V.VictoryChart>
              </View>

              {/* Shift Type Performance Comparison */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Shift Type Performance</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Average earnings by shift type
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 24, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryBar
                    data={Object.entries(heatmapData).reduce((acc, [dow, shifts]) => {
                      Object.entries(shifts).forEach(([shift, data]) => {
                        if (data.totalShifts > 0) {
                          acc.push({
                            x: `${dow} ${shift}`,
                            y: data.avgEffHourly,
                            fill: data.confidence === 'High' ? '#28a745' : 
                                  data.confidence === 'Medium' ? '#ffc107' : '#dc3545'
                          });
                        }
                      });
                      return acc;
                    }, [] as Array<{x: string, y: number, fill: string}>)}
                    x="x"
                    y="y"
                    style={{
                      data: {
                        fill: ({ datum }: any) => datum.fill,
                        stroke: "#333",
                        strokeWidth: 1
                      }
                    }}
                    cornerRadius={4}
                  />
                </V.VictoryChart>
              </View>

              {/* Earnings Breakdown Waterfall */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Earnings Breakdown</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  How your gross earnings are composed
                </Text>
                <V.VictoryChart 
                  domainPadding={{ x: 16, y: 12 }}
                  height={200}
                  style={{
                  }}
                >
                  <V.VictoryAxis 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryAxis 
                    dependentAxis 
                    tickFormat={(t: number) => `$${t}`} 
                    style={{ 
                      tickLabels: { fontSize: 10, fill: '#666' },
                      axis: { stroke: '#ddd' }
                    }} 
                  />
                  <V.VictoryBar
                    data={[
                      { x: 'Base Tips', y: metrics.tipsBase, fill: '#28a745' },
                      { x: 'Tip-out', y: -metrics.tipOut, fill: '#dc3545' },
                      { x: 'Net Tips', y: metrics.netTips, fill: '#20c997' },
                      { x: 'Wages', y: metrics.wages, fill: '#fd7e14' },
                      { x: 'Gross Total', y: metrics.gross, fill: '#2f95dc' }
                    ]}
                    x="x"
                    y="y"
                    style={{
                      data: {
                        fill: ({ datum }: any) => datum.fill,
                        stroke: "#333",
                        strokeWidth: 1
                      }
                    }}
                    cornerRadius={4}
                  />
                </V.VictoryChart>
              </View>
              </>
              )}

              {/* Day × Shift Heatmap */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '700', marginBottom: 12 }}>Day × Shift Heatmap</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  Average effective hourly rate by day and shift type
                </Text>
                
                {/* Heatmap Grid */}
                <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                  {/* Header Row */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#f8f9fa' }}>
                    <View style={{ width: 60, padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#eee' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Day</Text>
                    </View>
                    {['Brunch', 'Lunch', 'Dinner'].map(shift => (
                      <View key={shift} style={{ flex: 1, padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#eee' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{shift}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Data Rows */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dow => (
                    <View key={dow} style={{ flexDirection: 'row' }}>
                      <View style={{ width: 60, padding: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#f8f9fa' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{dow}</Text>
                      </View>
                      {['Brunch', 'Lunch', 'Dinner'].map(shift => {
                        const data = heatmapData[dow]?.[shift];
                        const hasData = data && data.totalShifts > 0;
                        const bgColor = hasData ? 
                          (data.avgEffHourly > 25 ? '#d4edda' : 
                           data.avgEffHourly > 20 ? '#fff3cd' : 
                           data.avgEffHourly > 15 ? '#f8d7da' : '#f8f9fa') : '#f8f9fa';
                        
                        return (
                          <View key={shift} style={{ 
                            flex: 1, 
                            padding: 8, 
                            borderRightWidth: 1, 
                            borderBottomWidth: 1, 
                            borderColor: '#eee',
                            backgroundColor: bgColor,
                            alignItems: 'center'
                          }}>
                            {hasData ? (
                              <>
                                <Text style={{ fontSize: 14, fontWeight: '600' }}>${data.avgEffHourly}</Text>
                                <Text style={{ fontSize: 10, color: '#666' }}>{data.totalShifts} shifts</Text>
                                <View style={{ 
                                  paddingHorizontal: 4, 
                                  paddingVertical: 1, 
                                  borderRadius: 4, 
                                  backgroundColor: data.confidence === 'High' ? '#28a745' : 
                                                data.confidence === 'Medium' ? '#ffc107' : '#dc3545'
                                }}>
                                  <Text style={{ fontSize: 8, color: 'white', fontWeight: '600' }}>
                                    {data.confidence}
                                  </Text>
                                </View>
                              </>
                            ) : (
                              <Text style={{ fontSize: 10, color: '#ccc' }}>—</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 12 }}>Smart Recommendations</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    Actionable insights to optimize your earnings
                  </Text>
                  
                  <View style={{ gap: 8 }}>
                    {recommendations.map((rec, index) => (
                      <View key={index} style={{
                        padding: 12,
                        borderWidth: 1,
                        borderColor: '#e9ecef',
                        borderRadius: 8,
                        backgroundColor: '#f8f9fa'
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <Text style={{ fontWeight: '600', fontSize: 14 }}>{rec.title}</Text>
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: rec.confidence === 'High' ? '#28a745' : 
                                              rec.confidence === 'Medium' ? '#ffc107' : '#dc3545'
                          }}>
                            <Text style={{ fontSize: 10, color: 'white', fontWeight: '600' }}>
                              {rec.confidence}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{rec.description}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#2f95dc' }}>{rec.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}