// app/(tabs)/settings.tsx
import { View, Text, Button, ScrollView } from 'react-native';
import { seedSampleData, getShifts, deleteAllShifts } from '../../data/db';
import { useState } from 'react';

export default function SettingsScreen() {
  const [log, setLog] = useState<string>('');

  const seed = async () => {
    await seedSampleData();
    setLog(prev => prev + '\nSeeded sample data');
  };

  const list = async () => {
    const rows = await getShifts();
    setLog(JSON.stringify(rows, null, 2));
    console.log('[SHIFTS]', rows);
  };

  const wipe = async () => {
    await deleteAllShifts();
    setLog('All rows deleted');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Developer Tools</Text>
      <Button title="Seed sample data" onPress={seed} />
      <Button title="List shifts (console + below)" onPress={list} />
      <Button title="Delete ALL shifts" onPress={wipe} />
      <Text selectable style={{ marginTop: 12, fontFamily: 'Courier' }}>{log}</Text>
    </ScrollView>
  );
}