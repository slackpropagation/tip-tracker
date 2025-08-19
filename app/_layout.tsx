// app/_layout.tsx
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { initDB } from '../data/db';
import 'react-native-get-random-values';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      await initDB();
      console.log('[DB] initialized');
    })();
  }, []);

  return <Slot />;
}