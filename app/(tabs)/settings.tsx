import { View, Text, Button, ScrollView, TextInput, Pressable, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { getAll, set, defaults } from '../../data/settings.web';
import { initDB, seedSampleData, getShifts, deleteAllShifts } from '../../data/db';

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

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Preferences</Text>

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
      <Text selectable style={{ marginTop: 12, fontFamily: 'Courier' }}>{log}</Text>
    </ScrollView>
  );
}