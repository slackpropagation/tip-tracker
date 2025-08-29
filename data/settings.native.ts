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

export async function get(key: SettingsKey): Promise<any> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings[key] ?? DEFAULTS[key];
    }
    return DEFAULTS[key];
  } catch (error) {
    console.warn('Failed to get setting:', key, error);
    return DEFAULTS[key];
  }
}

export async function set(key: SettingsKey, value: any): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const settings = stored ? JSON.parse(stored) : {};
    settings[key] = value;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to set setting:', key, value, error);
  }
}

export async function getAll(): Promise<Settings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return { ...DEFAULTS, ...settings };
    }
    return { ...DEFAULTS };
  } catch (error) {
    console.warn('Failed to get all settings:', error);
    return { ...DEFAULTS };
  }
}

export async function reset(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to reset settings:', error);
  }
}
