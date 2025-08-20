import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { getShiftById } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';

export default function ShiftDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await getShiftById(id);
        setRow(r || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>;
  }

  if (!row) {
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
      <Text>Shift not found.</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color:'#2f95dc' }}>Go back</Text>
      </Pressable>
    </View>;
  }

  const m = computeShiftMetrics({
    hours_worked: row.hours_worked,
    cash_tips: row.cash_tips,
    card_tips: row.card_tips,
    base_hourly_wage: row.base_hourly_wage,
    tip_out_basis: row.tip_out_basis,
    tip_out_percent: row.tip_out_percent,
    sales: row.sales,
    tip_out_override_amount: row.tip_out_override_amount,
  });

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
      <Text style={{ fontSize:20, fontWeight:'700' }}>
        {row.date} • {row.shift_type}
      </Text>

      <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:8 }}>
        <Text>Hours: {row.hours_worked}</Text>
        <Text>Cash tips: ${row.cash_tips}</Text>
        <Text>Card tips: ${row.card_tips}</Text>
        <Text>Tip-out basis: {row.tip_out_basis}</Text>
        <Text>Tip-out %: {row.tip_out_percent}</Text>
        {row.sales != null && <Text>Sales: ${row.sales}</Text>}
        {row.tip_out_override_amount != null && <Text>Override tip-out: ${row.tip_out_override_amount}</Text>}
        <Text>Base wage: ${row.base_hourly_wage}</Text>
        {row.notes ? <Text>Notes: {row.notes}</Text> : null}
      </View>

      <View style={{ padding:12, borderWidth:1, borderColor:'#eee', borderRadius:8 }}>
        <Text style={{ fontWeight:'600', marginBottom:6 }}>Computed</Text>
        <Text>Tip-out: ${m.tip_out.toFixed(2)}</Text>
        <Text>Net tips: ${m.net_tips.toFixed(2)}</Text>
        <Text>Wages: ${m.wages_earned.toFixed(2)}</Text>
        <Text>Gross: ${m.shift_gross.toFixed(2)}</Text>
        <Text>Eff/hr: ${m.effective_hourly.toFixed(2)}</Text>
      </View>

      {/* Next step we’ll add Edit/Delete here */}
    </ScrollView>
  );
}