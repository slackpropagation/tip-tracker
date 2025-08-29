import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SettingsKey =
  | 'startOfWeek'
  | 'defaultTipOutBasis'
  | 'defaultTipOutPercent'
  | 'rememberLastWage'
  | 'lastWage'
  | 'defaultHourlyWage';

export interface Settings {
  startOfWeek: 'sun' | 'mon';
  defaultTipOutBasis: 'tips' | 'sales';
  defaultTipOutPercent: number;
  rememberLastWage: boolean;
  lastWage: number | null;
  defaultHourlyWage: number;
}

const DEFAULTS: Settings = {
  startOfWeek: 'sun',
  defaultTipOutBasis: 'tips',
  defaultTipOutPercent: 3,
  rememberLastWage: false,
  lastWage: null,
  defaultHourlyWage: 15.00,
};

const STORAGE_KEY = 'tip_tracker_settings';

// Web-specific localStorage functions (only used on web)
const getLocalStorage = (key: string): any => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get from localStorage:', error);
      return null;
    }
  }
  return null;
};

const setLocalStorage = (key: string, value: any): void => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to set localStorage:', error);
    }
  }
};

// AsyncStorage functions (works on both web and native)
const getAsyncStorage = async (key: string): Promise<any> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to get from AsyncStorage:', error);
    return null;
  }
};

const setAsyncStorage = async (key: string, value: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to set AsyncStorage:', error);
  }
};

// Unified API
export async function get(key: SettingsKey): Promise<any> {
  // Try AsyncStorage first (works on all platforms)
  const asyncValue = await getAsyncStorage(STORAGE_KEY);
  if (asyncValue && asyncValue[key] !== undefined) {
    return asyncValue[key];
  }
  
  // Fallback to localStorage on web
  if (Platform.OS === 'web') {
    const localValue = getLocalStorage(STORAGE_KEY);
    if (localValue && localValue[key] !== undefined) {
      return localValue[key];
    }
  }
  
  return DEFAULTS[key];
}

export async function set(key: SettingsKey, value: any): Promise<void> {
  // Store in both AsyncStorage and localStorage (web)
  await setAsyncStorage(STORAGE_KEY, { [key]: value });
  
  if (Platform.OS === 'web') {
    const existing = getLocalStorage(STORAGE_KEY) || {};
    existing[key] = value;
    setLocalStorage(STORAGE_KEY, existing);
  }
}

export async function getAll(): Promise<Settings> {
  // Try AsyncStorage first
  const asyncSettings = await getAsyncStorage(STORAGE_KEY);
  
  // Merge with localStorage on web
  let allSettings = { ...DEFAULTS };
  
  if (asyncSettings) {
    allSettings = { ...allSettings, ...asyncSettings };
  }
  
  if (Platform.OS === 'web') {
    const localSettings = getLocalStorage(STORAGE_KEY);
    if (localSettings) {
      allSettings = { ...allSettings, ...localSettings };
    }
  }
  
  return allSettings;
}

export async function reset(): Promise<void> {
  await setAsyncStorage(STORAGE_KEY, null);
  
  if (Platform.OS === 'web') {
    setLocalStorage(STORAGE_KEY, null);
  }
}
