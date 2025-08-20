import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, Platform, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getShifts, deleteShift } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';

type Row = {
  id: string;
  date: string;
  shift_type: 'Brunch'|'Lunch'|'Dinner'|string;
  hours_worked: number;
  cash_tips: number;
  card_tips: number;
  tip_out_basis: 'tips'|'sales';
  tip_out_percent: number;
  sales: number|null;
  tip_out_override_amount: number|null;
  base_hourly_wage: number;
  notes: string|null;
};

export default function HistoryScreen() {
  const [rows, setRows] = useState<Row[]>([]);
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const data = await getShifts();
        if (active) setRows(data);
      })();
      return () => { active = false; };
    }, [])
  );

  const renderItem = ({ item }: { item: Row }) => {
    const m = computeShiftMetrics({
      hours_worked: item.hours_worked,
      cash_tips: item.cash_tips,
      card_tips: item.card_tips,
      base_hourly_wage: item.base_hourly_wage,
      tip_out_basis: item.tip_out_basis,
      tip_out_percent: item.tip_out_percent,
      sales: item.sales,
      tip_out_override_amount: item.tip_out_override_amount,
    });
    return (
      <Pressable
        onPress={() => router.push(`/shift/${item.id}`)}
        style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}
      >
        <Text style={{ fontWeight: '600' }}>
          {item.date} • {item.shift_type}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <Text>Net tips: ${m.net_tips.toFixed(2)}</Text>
          <Text>Eff/hr: ${m.effective_hourly.toFixed(2)}</Text>
        </View>
      </Pressable>
    );
  };

  if (!loading && rows.length === 0) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
        <Text style={{ fontSize:16, marginBottom:8 }}>No shifts yet</Text>
        <Text style={{ color:'#666', textAlign:'center' }}>
          Add your first shift from the “Add Shift” tab.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} />
      }
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}