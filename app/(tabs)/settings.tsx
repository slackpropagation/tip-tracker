import { View, Text, Button, ScrollView, TextInput, Pressable, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { getAll, set, defaults, reset } from '../../data/settings.web';
import { initDB, seedSampleData, getShifts, deleteAllShifts } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';

export default function SettingsScreen() {
  const [log, setLog] = useState('');
  const [prefs, setPrefs] = useState(getAll());

  useEffect(() => {
    setPrefs(getAll());
  }, []);

  const update = (key: keyof typeof prefs, value: any) => {
    setPrefs(p => ({ ...p, [key]: value }));
    set(key as any, value);
  };

  const append = (msg: string) =>
    setLog(prev => (prev ? prev + '\n' + msg : msg));

  const handleInit = async () => {
    try {
      await initDB();
      append('[OK] initDB() ran');
    } catch (e: any) {
      append('[ERR] initDB: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  const handleSeed = async () => {
    try {
      await seedSampleData();
      append('[OK] Seeded sample data');
    } catch (e: any) {
      append('[ERR] seed: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  const handleList = async () => {
    try {
      const rows = await getShifts();
      append(`[OK] getShifts(): ${rows.length} rows`);
      console.log('[SHIFTS]', rows);
      append(JSON.stringify(rows, null, 2));
    } catch (e: any) {
      append('[ERR] list: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  const handleWipe = async () => {
    try {
      await deleteAllShifts();
      append('[OK] Deleted all shifts');
    } catch (e: any) {
      append('[ERR] wipe: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  const handleExport = async () => {
    try {
      const rows = await getShifts();
      // Build CSV with raw + computed fields
      const headers = [
        'id','date','shift_type','hours_worked','cash_tips','card_tips','tip_out_basis','tip_out_percent','sales','tip_out_override_amount','base_hourly_wage','notes',
        'computed_tip_out','computed_net_tips','computed_wages_earned','computed_effective_hourly','computed_shift_gross'
      ];

      const esc = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };

      const lines = [headers.join(',')];
      for (const r of rows) {
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
        const vals = [
          r.id,
          r.date,
          r.shift_type,
          r.hours_worked,
          r.cash_tips,
          r.card_tips,
          r.tip_out_basis,
          r.tip_out_percent,
          r.sales,
          r.tip_out_override_amount,
          r.base_hourly_wage,
          r.notes,
          m.tip_out,
          m.net_tips,
          m.wages_earned,
          m.effective_hourly,
          m.shift_gross,
        ].map(esc);
        lines.push(vals.join(','));
      }
      const csv = lines.join('\n');

      // Trigger download (web only)
      if (typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tip-tracker.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        append('[OK] Exported CSV (download started)');
      } else {
        append('[Info] CSV export is only available on web.');
      }
    } catch (e: any) {
      append('[ERR] export: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Preferences</Text>
      <View style={{ marginBottom: 8 }}>
        <Button
          title="Reset to defaults"
          onPress={() => {
            reset();
            setPrefs(getAll());
          }}
        />
      </View>

      <Text>Start of Week</Text>
      <Pressable onPress={() => update('startOfWeek', 'sun')}>
        <Text>{prefs.startOfWeek === 'sun' ? '●' : '○'} Sunday</Text>
      </Pressable>
      <Pressable onPress={() => update('startOfWeek', 'mon')}>
        <Text>{prefs.startOfWeek === 'mon' ? '●' : '○'} Monday</Text>
      </Pressable>

      <Text style={{ marginTop: 12 }}>Default Tip-Out Basis</Text>
      <Pressable onPress={() => update('defaultTipOutBasis', 'tips')}>
        <Text>{prefs.defaultTipOutBasis === 'tips' ? '●' : '○'} Tips</Text>
      </Pressable>
      <Pressable onPress={() => update('defaultTipOutBasis', 'sales')}>
        <Text>{prefs.defaultTipOutBasis === 'sales' ? '●' : '○'} Sales</Text>
      </Pressable>

      <Text style={{ marginTop: 12 }}>Default Tip-Out Percent</Text>
      <TextInput
        keyboardType="numeric"
        value={String(prefs.defaultTipOutPercent ?? defaults.defaultTipOutPercent)}
        onChangeText={(txt) => {
          const n = Number(txt.replace(',', '.'));
          if (!Number.isNaN(n) && n >= 0 && n <= 100) update('defaultTipOutPercent', n);
        }}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 6, marginBottom: 8 }}
      />
      <Text style={{ color: '#666', fontSize: 12 }}>Enter percent between 0 and 100.</Text>

      <Text style={{ marginTop: 12 }}>Remember Last Wage</Text>
      <Switch
        value={prefs.rememberLastWage}
        onValueChange={(val) => update('rememberLastWage', val)}
      />

      <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 24 }}>Developer Tools</Text>
      <Button title="Init DB" onPress={handleInit} />
      <Button title="Seed sample data" onPress={handleSeed} />
      <Button title="List shifts" onPress={handleList} />
      <Button title="Delete ALL shifts" onPress={handleWipe} />
      <Button title="Export CSV" onPress={handleExport} />
      <Text selectable style={{ marginTop: 12, fontFamily: 'Courier' }}>{log}</Text>
    </ScrollView>
  );
}