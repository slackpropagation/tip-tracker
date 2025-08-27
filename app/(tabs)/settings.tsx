import { View, Text, Button, ScrollView, TextInput, Pressable, Switch, Modal } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { getAll, set, defaults, reset } from '../../data/settings.web';
import { initDB, seedSampleData, getShifts, deleteAllShifts } from '../../data/db';
import { exportCsv } from '../../data/csv.web';
import { parseCsv, importCsv } from '../../data/csvImport.web';

export default function SettingsScreen() {
  const [log, setLog] = useState('');
  const [prefs, setPrefs] = useState(getAll());
  const [pendingPrefs, setPendingPrefs] = useState(getAll());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [importInfo, setImportInfo] = useState<{ rows: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmWipeVisible, setConfirmWipeVisible] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<any>(null);

  useEffect(() => {
    setPrefs(getAll());
  }, []);

  const update = (key: keyof typeof prefs, value: any) => {
    setPendingPrefs(p => ({ ...p, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const applyChanges = () => {
    // Save all pending changes to storage
    Object.entries(pendingPrefs).forEach(([key, value]) => {
      set(key as any, value);
    });
    // Update the main prefs state
    setPrefs(pendingPrefs);
    setHasUnsavedChanges(false);
    append('[OK] Settings applied successfully');
  };

  const discardChanges = () => {
    setPendingPrefs(prefs);
    setHasUnsavedChanges(false);
    append('[Info] Changes discarded');
  };

  const append = (msg: string) => {
    setLog(prev => (prev ? prev + '\n' + msg : msg));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const lower = msg.toLowerCase();
    const type = lower.startsWith('[ok]') ? 'ok' : lower.startsWith('[err]') ? 'err' : null;
    if (type) {
      setToast({ msg, type });
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    }
  };

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

  const handleWipe = () => {
    setConfirmWipeVisible(true);
  };

  const performWipe = async () => {
    try {
      await deleteAllShifts();
      append('[OK] Deleted all shifts');
    } catch (e: any) {
      append('[ERR] wipe: ' + (e?.message ?? String(e)));
      console.error(e);
    } finally {
      setConfirmWipeVisible(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportCsv('tip-tracker.csv');
      append('[OK] Exported CSV (download started)');
    } catch (e: any) {
      append('[ERR] export: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  const handlePickCsv = () => {
    if (typeof window === 'undefined') {
      append('[Info] Import is web-only for now.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: any) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const res = parseCsv(text);
      setImportInfo({ rows: res.rows.length, skipped: res.skipped, errors: res.errors.slice(0, 5) });
      append(`[OK] Parsed CSV: ${res.rows.length} valid, ${res.skipped} skipped`);
      // Store parsed rows on the ref so we can import on demand
      (fileInputRef as any).parsedRows = res.rows;
    } catch (err: any) {
      append('[ERR] parse: ' + (err?.message ?? String(err)));
      console.error(err);
    } finally {
      // reset input so picking the same file again re-triggers change
      if (fileInputRef.current) fileInputRef.current.value = '' as any;
    }
  };

  const handleImportAppend = async () => {
    const rows = (fileInputRef as any).parsedRows || [];
    if (!rows.length) { append('[Info] No parsed rows to import.'); return; }
    const { inserted } = await importCsv({ mode: 'append', rows });
    append(`[OK] Imported ${inserted} rows (append)`);
  };

  const handleImportReplace = async () => {
    const rows = (fileInputRef as any).parsedRows || [];
    if (!rows.length) { append('[Info] No parsed rows to import.'); return; }
    if (!confirm('Replace ALL existing shifts with the CSV data? This cannot be undone.')) return;
    const { inserted } = await importCsv({ mode: 'replace', rows });
    append(`[OK] Imported ${inserted} rows (replace all)`);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 16 }}>Settings</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Preferences</Text>
        {hasUnsavedChanges && (
          <Text style={{ fontSize: 12, color: '#FF9500', fontWeight: '500' }}>• Unsaved Changes</Text>
        )}
      </View>
      <View style={{ marginBottom: 8 }}>
        <Button
          title="Reset to defaults"
          onPress={() => {
            reset();
            const defaults = getAll();
            setPrefs(defaults);
            setPendingPrefs(defaults);
            setHasUnsavedChanges(false);
          }}
        />
      </View>

      <Text>Start of Week</Text>
      <Pressable onPress={() => update('startOfWeek', 'sun')}>
        <Text>{pendingPrefs.startOfWeek === 'sun' ? '●' : '○'} Sunday</Text>
      </Pressable>
      <Pressable onPress={() => update('startOfWeek', 'mon')}>
        <Text>{pendingPrefs.startOfWeek === 'mon' ? '●' : '○'} Monday</Text>
      </Pressable>

      <Text style={{ marginTop: 12 }}>Default Tip-Out Basis</Text>
      <Pressable onPress={() => update('defaultTipOutBasis', 'tips')}>
        <Text>{pendingPrefs.defaultTipOutBasis === 'tips' ? '●' : '○'} Tips</Text>
      </Pressable>
      <Pressable onPress={() => update('defaultTipOutBasis', 'sales')}>
        <Text>{pendingPrefs.defaultTipOutBasis === 'sales' ? '●' : '○'} Sales</Text>
      </Pressable>

      <Text style={{ marginTop: 12 }}>Default Tip-Out Percent</Text>
      <TextInput
        keyboardType="numeric"
        value={String(pendingPrefs.defaultTipOutPercent ?? defaults.defaultTipOutPercent)}
        onChangeText={(txt) => {
          const n = Number(txt.replace(',', '.'));
          if (!Number.isNaN(n) && n >= 0 && n <= 100) update('defaultTipOutPercent', n);
        }}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 6, marginBottom: 8 }}
      />
      <Text style={{ color: '#666', fontSize: 12 }}>Enter percent between 0 and 100.</Text>

      <Text style={{ marginTop: 12 }}>Default Hourly Wage</Text>
      <TextInput
        keyboardType="numeric"
        value={String(pendingPrefs.defaultHourlyWage ?? defaults.defaultHourlyWage)}
        onChangeText={(txt) => {
          const n = Number(txt.replace(',', '.'));
          if (!Number.isNaN(n) && n >= 0) update('defaultHourlyWage', n);
        }}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 6, marginBottom: 8 }}
      />
      <Text style={{ color: '#666', fontSize: 12 }}>Enter your default hourly wage in dollars.</Text>

      <Text style={{ marginTop: 12 }}>Remember Last Wage</Text>
      <Switch
        value={pendingPrefs.rememberLastWage}
        onValueChange={(val) => update('rememberLastWage', val)}
      />

      {/* Apply/Discard Changes */}
      {hasUnsavedChanges && (
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
          <Button 
            title="Apply Changes" 
            onPress={applyChanges}
            color="#007AFF"
          />
          <Button 
            title="Discard Changes" 
            onPress={discardChanges}
            color="#FF3B30"
          />
        </View>
      )}

      <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 24 }}>Developer Tools</Text>
      <Button title="Init DB" onPress={handleInit} />
      <Button title="Seed sample data" onPress={handleSeed} />
      <Button title="List shifts" onPress={handleList} />
      <Button title="Delete ALL shifts" onPress={handleWipe} />
      <Button title="Export CSV" onPress={handleExport} />

      {/* Import CSV (web) */}
      <View style={{ marginTop: 12 }}>
        <Button title="Import CSV" onPress={handlePickCsv} />
        {/* @ts-ignore: RN Web allows raw input elements */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {importInfo && (
          <View style={{ marginTop: 8 }}>
            <Text>Parsed: {importInfo.rows} valid, {importInfo.skipped} skipped</Text>
            {importInfo.errors.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontWeight: '600' }}>Warnings/Errors (first 5):</Text>
                {importInfo.errors.map((e, idx) => (
                  <Text key={idx} style={{ color: '#a00' }}>• {e}</Text>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="Append" onPress={handleImportAppend} />
              <Button title="Replace all" color="#b00" onPress={handleImportReplace} />
            </View>
          </View>
        )}
      </View>

      <Modal
        transparent
        visible={confirmWipeVisible}
        animationType="fade"
        onRequestClose={() => setConfirmWipeVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 8, width: '85%', maxWidth: 420 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Delete all data?</Text>
            <Text style={{ marginBottom: 12 }}>
              This will permanently delete all shifts from your device. This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button title="Cancel" onPress={() => setConfirmWipeVisible(false)} />
              <Button title="Delete" color="#b00" onPress={performWipe} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast (success/error) */}
      <Modal transparent visible={!!toast} animationType="fade" onRequestClose={() => setToast(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 520, borderRadius: 10, padding: 12, backgroundColor: toast?.type === 'ok' ? '#129e57' : '#cc3344' }}>
            <Text style={{ color: 'white', fontWeight: '700', marginBottom: 4 }}>
              {toast?.type === 'ok' ? 'Success' : 'Error'}
            </Text>
            <Text style={{ color: 'white' }}>
              {(toast?.msg || '').replace(/^\[(OK|ERR)\]\s*/i, '')}
            </Text>
          </View>
        </View>
      </Modal>

      <Text selectable style={{ marginTop: 12, fontFamily: 'Courier' }}>{log}</Text>
    </ScrollView>
  );
}