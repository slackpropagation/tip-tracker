

// data/settings.web.ts
// Web-only settings store backed by localStorage.
// Mirrors API we'll later provide on native via AsyncStorage.

export type SettingsKey =
  | 'startOfWeek'
  | 'defaultTipOutBasis'
  | 'defaultTipOutPercent'
  | 'rememberLastWage'
  | 'lastWage';

export type StartOfWeek = 'sun' | 'mon';
export type TipOutBasis = 'tips' | 'sales';

export interface Settings {
  startOfWeek: StartOfWeek;           // calendar preference
  defaultTipOutBasis: TipOutBasis;     // default basis for tip-out
  defaultTipOutPercent: number;        // default % (0–100)
  rememberLastWage: boolean;           // whether to prefill wage from last entry
  lastWage: number | null;             // cached last wage when rememberLastWage=true
}

const DEFAULTS: Settings = {
  startOfWeek: 'sun',
  defaultTipOutBasis: 'tips',
  defaultTipOutPercent: 0,
  rememberLastWage: false,
  lastWage: null,
};

function parse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // If it was stored as a plain string earlier
    return (raw as unknown) as T;
  }
}

/** Get a single settings value. */
export function get<K extends SettingsKey>(key: K): Settings[K] {
  const raw = localStorage.getItem(key);
  return parse<Settings[K]>(raw, DEFAULTS[key]);
}

/** Set a single settings value. */
export function set<K extends SettingsKey>(key: K, value: Settings[K]): void {
  if (value === undefined || value === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

/** Get the full settings object (defaults + overrides). */
export function getAll(): Settings {
  const out: Settings = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as SettingsKey[]).forEach((k) => {
    const raw = localStorage.getItem(k);
    if (raw != null) out[k] = parse(raw, DEFAULTS[k] as any) as any;
  });
  return out;
}

/** Update multiple settings at once. */
export function setAll(partial: Partial<Settings>): void {
  (Object.keys(partial) as SettingsKey[]).forEach((k) => {
    // @ts-expect-error index signature OK via runtime keys
    const val = partial[k];
    if (val === undefined || val === null) {
      localStorage.removeItem(k);
    } else {
      localStorage.setItem(k, JSON.stringify(val));
    }
  });
}

/** Reset everything back to defaults. */
export function reset(): void {
  (Object.keys(DEFAULTS) as SettingsKey[]).forEach((k) => localStorage.removeItem(k));
}

/** Export defaults for UI to show placeholders. */
export const defaults = DEFAULTS;