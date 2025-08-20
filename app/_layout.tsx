// app/_layout.tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { initDB } from '../data/db';
import 'react-native-get-random-values';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      (async () => { await initDB(); console.log('[DB] initialized'); })();
    } else {
      console.warn('[DB] Web: skipping SQLite init');
    }
  }, []);
  return <Slot />;
}