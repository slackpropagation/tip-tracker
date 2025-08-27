import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useToast } from '../../components/Toast';
import { computeDerived, computeTipOut } from '../../data/calculations';
import { insertShift } from '../../data/db';
import { get, getAll, set } from '../../data/settings.web';

const fieldBox = { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 };
const row = { flexDirection: 'row', gap: 12 };

export default function AddShiftScreen() {
  const { showToast, ToastComponent } = useToast();
  
  // Required
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10)); // YYYY-MM-DD
  const [shiftType, setShiftType] = useState<'Brunch'|'Lunch'|'Dinner'>('Dinner');
  const [hours, setHours] = useState<string>('');
  const [cash, setCash] = useState<string>('');
  const [card, setCard] = useState<string>('');
  const [basis, setBasis] = useState<'tips'|'sales'>('tips');
  const [pct, setPct] = useState<string>('3'); // user-specified; editable
  const [sales, setSales] = useState<string>(''); // only if basis=sales
  const [overrideAmt, setOverrideAmt] = useState<string>(''); // optional
  const [baseWage, setBaseWage] = useState<string>(''); // required per shift (no default)
  const [notes, setNotes] = useState<string>('');
  const [defaultWagePlaceholder, setDefaultWagePlaceholder] = useState<string>('15.00');
  const [showOverrideTooltip, setShowOverrideTooltip] = useState(false);

  useEffect(() => {
    const s = getAll();
    // Prefill tip-out defaults
    if (s.defaultTipOutBasis === 'tips' || s.defaultTipOutBasis === 'sales') {
      setBasis(s.defaultTipOutBasis);
    }
    if (typeof s.defaultTipOutPercent === 'number' && s.defaultTipOutPercent >= 0 && s.defaultTipOutPercent <= 100) {
      setPct(String(s.defaultTipOutPercent));
    }
    // Set default wage placeholder from settings
    if (typeof s.defaultHourlyWage === 'number' && s.defaultHourlyWage >= 0) {
      setDefaultWagePlaceholder(s.defaultHourlyWage.toFixed(2));
    }
    // Prefill last wage if enabled
    if (s.rememberLastWage && s.lastWage != null) {
      setBaseWage(String(s.lastWage));
    }
  }, []);

  const sanitize = (s: string) => s.replace(/[^\d.,\-]/g, '').replace(',', '.');

  // Live math preview
  const tipOut = useMemo(() => computeTipOut({
    cash_tips: cash, card_tips: card, tip_out_basis: basis, tip_out_percent: pct, sales, tip_out_override_amount: overrideAmt
  }), [cash, card, basis, pct, sales, overrideAmt]);

  const derived = useMemo(() => computeDerived({
    hours_worked: hours,
    cash_tips: cash,
    card_tips: card,
    base_hourly_wage: baseWage,
    tip_out: tipOut,
  }), [hours, cash, card, baseWage, tipOut]);

  // Validation
  const hoursNum = Number(hours);
  const baseWageNum = Number(baseWage);
  const pctNum = Number(pct);

  const errors: string[] = [];
  if (!date) errors.push('Date required');
  if (!(hoursNum > 0 && hoursNum <= 18)) errors.push('Hours must be between 0 and 18');
  if (!(baseWageNum >= 0)) errors.push('Base wage must be ≥ 0');
  if (!(pctNum >= 0 && pctNum <= 100)) errors.push('Tip-out percent must be 0–100');
  if (basis === 'sales' && !sales) errors.push('Sales required when basis = sales');

  const canSave = errors.length === 0;

  const onSave = async () => {
    if (!canSave) return;
    const payload = {
      date,
      shift_type: shiftType,
      hours_worked: Number(hours) || 0,
      cash_tips: Number(cash) || 0,
      card_tips: Number(card) || 0,
      tip_out_basis: basis,
      tip_out_percent: Number(pct) || 0,
      sales: basis === 'sales' ? (Number(sales) || 0) : null,
      tip_out_override_amount: overrideAmt ? (Number(overrideAmt) || 0) : null,
      base_hourly_wage: Number(baseWage) || 0,
      notes: notes || null,
    };
    await insertShift(payload);
    // Persist last wage for next time if enabled
    const remember = get('rememberLastWage');
    if (remember) {
      const wageNum = Number(baseWage);
      if (!Number.isNaN(wageNum) && wageNum >= 0) {
        set('lastWage', wageNum);
      }
    }
    // reset minimal fields; keep last shift type/basis/pct for convenience
    setHours(''); setCash(''); setCard(''); setSales(''); setOverrideAmt(''); setBaseWage(''); setNotes('');
    // Show success toast
    showToast('Shift saved successfully! ✅', 'success');
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>Add Shift</Text>

      {/* Date */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Date (YYYY-MM-DD)</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="2025-08-20" autoCapitalize="none" />
      </View>

      {/* Shift type */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Shift Type</Text>
        <View style={row}>
          {(['Brunch','Lunch','Dinner'] as const).map(v => (
            <Pressable key={v} onPress={() => setShiftType(v)} style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: shiftType === v ? '#2f95dc' : '#f0f0f0'
            }}>
              <Text style={{ color: shiftType === v ? 'white' : 'black' }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Hours */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Hours Worked</Text>
        <TextInput
          value={hours}
          onChangeText={(v) => setHours(sanitize(v))}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      </View>

      {/* Tips */}
      <View style={{ ...fieldBox }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Tips</Text>
        <View style={row}>
          <View style={{ flex: 1 }}>
            <Text>Cash</Text>
            <TextInput
              value={cash}
              onChangeText={(v) => setCash(sanitize(v))}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text>Card</Text>
            <TextInput
              value={card}
              onChangeText={(v) => setCard(sanitize(v))}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
        </View>
      </View>

      {/* Tip-out */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Tip-out</Text>
        <View style={row}>
          {(['tips','sales'] as const).map(v => (
            <Pressable key={v} onPress={() => setBasis(v)} style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: basis === v ? '#2f95dc' : '#f0f0f0'
            }}>
              <Text style={{ color: basis === v ? 'white' : 'black' }}>{v === 'tips' ? '% of tips' : '% of sales'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: 8 }}>
          <Text>Percent (%)</Text>
          <TextInput
            value={pct}
            onChangeText={(v) => setPct(sanitize(v))}
            placeholder="3"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
        {basis === 'sales' && (
          <View style={{ marginTop: 8 }}>
            <Text>Sales</Text>
            <TextInput
              value={sales}
              onChangeText={(v) => setSales(sanitize(v))}
              placeholder="1000"
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
        )}
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text>Override amount (optional)</Text>
            <Pressable
              onHoverIn={() => setShowOverrideTooltip(true)}
              onHoverOut={() => setShowOverrideTooltip(false)}
              style={{ position: 'relative' }}
            >
              <Text style={{ fontSize: 16, color: '#666', cursor: 'help' }}>ℹ️</Text>
              {showOverrideTooltip && (
                <View style={{
                  position: 'absolute',
                  bottom: 25,
                  left: -100,
                  width: 200,
                  backgroundColor: '#333',
                  padding: 8,
                  borderRadius: 6,
                  zIndex: 1000,
                }}>
                  <Text style={{ color: 'white', fontSize: 12, textAlign: 'center' }}>
                    Manually set tip-out amount instead of using percentage calculation
                  </Text>
                  <View style={{
                    position: 'absolute',
                    top: 20,
                    left: 100,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 5,
                    borderRightWidth: 5,
                    borderTopWidth: 5,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: '#333',
                  }} />
                </View>
              )}
            </Pressable>
          </View>
          <TextInput
            value={overrideAmt}
            onChangeText={(v) => setOverrideAmt(sanitize(v))}
            placeholder="50"
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
        <Text style={{ marginTop: 8 }}>Calculated tip-out: ${tipOut.toFixed(2)}</Text>
      </View>

      {/* Base wage */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Base hourly wage</Text>
        <TextInput
          value={baseWage}
          onChangeText={(v) => setBaseWage(sanitize(v))}
          placeholder={defaultWagePlaceholder}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      </View>

      {/* Notes */}
      <View style={fieldBox}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Notes (optional)</Text>
        <TextInput value={notes} onChangeText={setNotes} />
      </View>

      {/* Live preview */}
      <View style={{ ...fieldBox, backgroundColor: '#fafafa' }}>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Live preview</Text>
        <Text>Net tips: ${derived.net_tips.toFixed(2)}</Text>
        <Text>Wages: ${derived.wages_earned.toFixed(2)}</Text>
        <Text>Gross: ${derived.shift_gross.toFixed(2)}</Text>
        <Text>Hourly tips: ${derived.hourly_tips.toFixed(2)}</Text>
        <Text>Effective hourly: ${derived.effective_hourly.toFixed(2)}</Text>
      </View>

      {/* Errors */}
      {errors.length > 0 && (
        <View style={{ ...fieldBox, borderColor: '#f5a' }}>
          {errors.map((e, i) => (
            <Text key={i} style={{ color: '#c00' }}>• {e}</Text>
          ))}
        </View>
      )}

      {/* Save */}
      <Pressable onPress={onSave} disabled={!canSave} style={{
        backgroundColor: canSave ? '#2f95dc' : '#a7c9e5',
        paddingVertical: 14, borderRadius: 10, alignItems: 'center'
      }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Save Shift</Text>
      </Pressable>

      <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
        {Platform.OS === 'web' ? 'Using web storage (AsyncStorage polyfill)' : 'Using SQLite on device'}
      </Text>
    </ScrollView>
    <ToastComponent />
  </>
  );
}