import { View, Text, Button, ScrollView } from 'react-native';
import { useState } from 'react';
import { initDB, seedSampleData, getShifts, deleteAllShifts } from '../../data/db';

export default function SettingsScreen() {
  const [log, setLog] = useState('');

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
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Developer Tools</Text>
      <Button title="Init DB" onPress={handleInit} />
      <Button title="Seed sample data" onPress={handleSeed} />
      <Button title="List shifts" onPress={handleList} />
      <Button title="Delete ALL shifts" onPress={handleWipe} />
      <Text selectable style={{ marginTop: 12, fontFamily: 'Courier' }}>{log}</Text>
    </ScrollView>
  );
}