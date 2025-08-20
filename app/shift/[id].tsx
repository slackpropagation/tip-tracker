// app/shift/[id].tsx
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, TextInput, Platform } from 'react-native';
import { getShiftById, updateShift, deleteShift } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';

const fieldBox = { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginTop: 8 };
const row = { flexDirection: 'row', gap: 12 };

function confirmDelete(msg: string) {
  if (Platform.OS === 'web') {
    return window.confirm(msg);
  } else {
    // Minimal inline confirm for native; could use Alert.alert if you prefer
    return window.confirm ? window.confirm(msg) : true;
  }
}

const sanitize = (s: string) => (s ?? '').toString().replace(/[^\d.,\-]/g, '').replace(',', '.');

export default function ShiftDetail() {
  const params = useLocalSearchParams();
  const idParam = (Array.isArray(params.id) ? params.id[0] : params.id) as string;
  const [rowData, setRowData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [date, setDate] = useState('');
  const [shiftType, setShiftType] = useState<'Brunch'|'Lunch'|'Dinner'|string>('Dinner');
  const [hours, setHours] = useState('');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [basis, setBasis] = useState<'tips'|'sales'>('tips');
  const [pct, setPct] = useState('');
  const [sales, setSales] = useState('');
  const [overrideAmt, setOverrideAmt] = useState('');
  const [baseWage, setBaseWage] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await getShiftById(idParam);
      setRowData(r ?? null);
      if (r) {
        setDate(r.date ?? '');
        setShiftType(r.shift_type ?? 'Dinner');
        setHours(String(r.hours_worked ?? ''));
        setCash(String(r.cash_tips ?? ''));
        setCard(String(r.card_tips ?? ''));
        setBasis(r.tip_out_basis ?? 'tips');
        setPct(String(r.tip_out_percent ?? ''));
        setSales(r.sales != null ? String(r.sales) : '');
        setOverrideAmt(r.tip_out_override_amount != null ? String(r.tip_out_override_amount) : '');
        setBaseWage(String(r.base_hourly_wage ?? ''));
        setNotes(r.notes ?? '');
      }
      setLoading(false);
    })();
  }, [idParam]);

  const metrics = useMemo(() => computeShiftMetrics({
    hours_worked: hours,
    cash_tips: cash,
    card_tips: card,
    base_hourly_wage: baseWage,
    tip_out_basis: basis,
    tip_out_percent: pct,
    sales,
    tip_out_override_amount: overrideAmt,
  }), [hours, cash, card, baseWage, basis, pct, sales, overrideAmt]);

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!rowData) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
        <Text>Shift not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color:'#2f95dc' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const errors: string[] = [];
  if (editing) {
    const hoursNum = Number(sanitize(hours)) || 0;
    const baseNum = Number(sanitize(baseWage));
    const pctNum = Number(sanitize(pct));
    if (!(hoursNum > 0 && hoursNum <= 18)) errors.push('Hours must be between 0 and 18');
    if (!(pctNum >= 0 && pctNum <= 100)) errors.push('Tip-out percent must be 0–100');
    if (basis === 'sales' && !sales) errors.push('Sales required when basis = sales');
    if (!(baseNum >= 0)) errors.push('Base wage must be ≥ 0');
    if (!date) errors.push('Date required');
  }

const onSave = async () => {
  if (errors.length) return;

  await updateShift(String(idParam), {
    date,
    shift_type: shiftType,
    hours_worked: Number(sanitize(hours)) || 0,
    cash_tips: Number(sanitize(cash)) || 0,
    card_tips: Number(sanitize(card)) || 0,
    tip_out_basis: basis,
    tip_out_percent: Number(sanitize(pct)) || 0,
    sales: basis === 'sales' ? (Number(sanitize(sales)) || 0) : null,
    tip_out_override_amount: overrideAmt ? (Number(sanitize(overrideAmt)) || 0) : null,
    base_hourly_wage: Number(sanitize(baseWage)) || 0,
    notes: notes || null,
  });

  router.replace('/history');
};

  const onDelete = async () => {
    const ok = confirmDelete('Delete this shift permanently?');
    if (!ok) return;
    await deleteShift(String(idParam));
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap: 8, justifyContent:'space-between' }}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical:8, paddingHorizontal:8 }}>
          <Text style={{ color:'#2f95dc' }}>Back</Text>
        </Pressable>
        <Text style={{ fontSize:20, fontWeight:'700', flex:1, textAlign:'center' }}>
          {rowData.date} • {rowData.shift_type}
        </Text>
        {!editing ? (
          <Pressable onPress={() => setEditing(true)} style={{ paddingVertical:8, paddingHorizontal:12, backgroundColor:'#2f95dc', borderRadius:8 }}>
            <Text style={{ color:'white', fontWeight:'600' }}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection:'row', gap:8 }}>
            <Pressable onPress={onSave} style={{ paddingVertical:8, paddingHorizontal:12, backgroundColor:'#2f95dc', borderRadius:8 }}>
              <Text style={{ color:'white', fontWeight:'600' }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)} style={{ paddingVertical:8, paddingHorizontal:12, backgroundColor:'#999', borderRadius:8 }}>
              <Text style={{ color:'white', fontWeight:'600' }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Editable fields */}
      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:4 }}>Date (YYYY-MM-DD)</Text>
        <TextInput editable={editing} value={date} onChangeText={setDate} autoCapitalize="none" />
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:8 }}>Shift Type</Text>
        <View style={row}>
          {(['Brunch','Lunch','Dinner'] as const).map(v => (
            <Pressable
              key={v}
              disabled={!editing}
              onPress={() => setShiftType(v)}
              style={{
                paddingVertical:8, paddingHorizontal:12, borderRadius:20,
                backgroundColor: shiftType === v ? '#2f95dc' : '#f0f0f0',
                opacity: editing ? 1 : 0.6
              }}>
              <Text style={{ color: shiftType === v ? 'white' : 'black' }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:4 }}>Hours Worked</Text>
        <TextInput editable={editing} value={hours} onChangeText={(v)=>setHours(sanitize(v))} placeholder="6.5" keyboardType="decimal-pad" inputMode="decimal" />
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:8 }}>Tips</Text>
        <View style={row}>
          <View style={{ flex:1 }}>
            <Text>Cash</Text>
            <TextInput editable={editing} value={cash} onChangeText={(v)=>setCash(sanitize(v))} placeholder="120" keyboardType="decimal-pad" inputMode="decimal" />
          </View>
          <View style={{ flex:1 }}>
            <Text>Card</Text>
            <TextInput editable={editing} value={card} onChangeText={(v)=>setCard(sanitize(v))} placeholder="280" keyboardType="decimal-pad" inputMode="decimal" />
          </View>
        </View>
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:8 }}>Tip-out</Text>
        <View style={row}>
          {(['tips','sales'] as const).map(v => (
            <Pressable
              key={v}
              disabled={!editing}
              onPress={() => setBasis(v)}
              style={{
                paddingVertical:8, paddingHorizontal:12, borderRadius:20,
                backgroundColor: basis === v ? '#2f95dc' : '#f0f0f0',
                opacity: editing ? 1 : 0.6
              }}>
              <Text style={{ color: basis === v ? 'white' : 'black' }}>{v === 'tips' ? '% of tips' : '% of sales'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop:8 }}>
          <Text>Percent (%)</Text>
          <TextInput editable={editing} value={pct} onChangeText={(v)=>setPct(sanitize(v))} placeholder="3" keyboardType="decimal-pad" inputMode="decimal" />
        </View>

        {basis === 'sales' && (
          <View style={{ marginTop:8 }}>
            <Text>Sales</Text>
            <TextInput editable={editing} value={sales} onChangeText={(v)=>setSales(sanitize(v))} placeholder="1000" keyboardType="decimal-pad" inputMode="decimal" />
          </View>
        )}

        <View style={{ marginTop:8 }}>
          <Text>Override amount (optional)</Text>
          <TextInput editable={editing} value={overrideAmt} onChangeText={(v)=>setOverrideAmt(sanitize(v))} placeholder="50" keyboardType="decimal-pad" inputMode="decimal" />
        </View>
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:4 }}>Base hourly wage</Text>
        <TextInput editable={editing} value={baseWage} onChangeText={(v)=>setBaseWage(sanitize(v))} placeholder="5" keyboardType="decimal-pad" inputMode="decimal" />
      </View>

      <View style={fieldBox}>
        <Text style={{ fontWeight:'600', marginBottom:4 }}>Notes (optional)</Text>
        <TextInput editable={editing} value={notes} onChangeText={setNotes} placeholder="#busy #tourists" />
      </View>

      {/* Computed */}
      <View style={{ ...fieldBox, backgroundColor:'#fafafa' }}>
        <Text style={{ fontWeight:'600', marginBottom:6 }}>Computed</Text>
        <Text>Tip-out: ${metrics.tip_out.toFixed(2)}</Text>
        <Text>Net tips: ${metrics.net_tips.toFixed(2)}</Text>
        <Text>Wages: ${metrics.wages_earned.toFixed(2)}</Text>
        <Text>Gross: ${metrics.shift_gross.toFixed(2)}</Text>
        <Text>Eff/hr: ${metrics.effective_hourly.toFixed(2)}</Text>
      </View>

      {/* Danger zone */}
      {!editing && (
        <Pressable onPress={onDelete} style={{ paddingVertical:12, alignItems:'center', borderRadius:8, backgroundColor:'#ffe5e5' }}>
          <Text style={{ color:'#b00020', fontWeight:'700' }}>Delete Shift</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}