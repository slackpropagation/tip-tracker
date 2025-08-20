// app/_layout.tsx
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { initDB } from '../data/db';
import 'react-native-get-random-values';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      (async () => {
        await initDB();
        console.log('[DB] initialized');
      })();
    } else {
      console.warn('[DB] Skipping SQLite init on web');
    }
  }, []);

  return <Slot />;
}