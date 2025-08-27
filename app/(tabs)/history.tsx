import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, Platform, Modal } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, Link } from 'expo-router';
import { getShifts, deleteShift, insertShift } from '../../data/db';
import { computeShiftMetrics } from '../../data/calculations';
import { useRouter } from 'expo-router';
import { EmptyState } from '../../components/EmptyState';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

type Row = {
  id: string;
  date: string;
  shift_type: 'Brunch'|'Lunch'|'Dinner'|string;
  hours_worked: number;
  cash_tips: number;
  card_tips: number;
  tip_out_basis: 'tips'|'sales';
  tip_out_percent: number;
  sales: number|null;
  tip_out_override_amount: number|null;
  base_hourly_wage: number;
  notes: string|null;
};

export default function HistoryScreen() {
  const router = useRouter();
  const { showConfirm, ConfirmDialogComponent } = useConfirmDialog();
  const { showToast, ToastComponent } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Row | null>(null);
  const undoTimer = (typeof window !== 'undefined') ? (window as any) : ({} as any);
  let undoHandle: any = null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getShifts();
      data.sort((a: Row, b: Row) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmAndDelete = useCallback((id: string) => {
    console.log('confirmAndDelete called with ID:', id);
    const row = rows.find(r => r.id === id) || null;
    console.log('Found row to delete:', row);

    const reallyDelete = async () => {
      console.log('reallyDelete function called - starting deletion');
      try {
        console.log('Calling deleteShift with ID:', id);
        await deleteShift(id);
        console.log('deleteShift completed successfully');
        
        console.log('Setting lastDeleted state');
        setLastDeleted(row);
        
        console.log('Setting undoVisible to true');
        setUndoVisible(true);
        
        console.log('Showing success toast');
        showToast('Shift deleted successfully! 🗑️', 'success');
        
        console.log('Reloading data');
        await load();
        
        console.log('Setting up auto-hide timer');
        // auto-hide after 4s
        try { if (undoHandle) clearTimeout(undoHandle); } catch {}
        undoHandle = undoTimer.setTimeout(() => {
          console.log('Auto-hiding undo modal');
          setUndoVisible(false);
        }, 4000);
        
        console.log('Delete process completed successfully');
      } catch (error) {
        console.error('Error in reallyDelete:', error);
        showToast('Failed to delete shift', 'error');
      }
    };

    console.log('Showing confirmation dialog');
    showConfirm(
      'Delete Shift',
      'Are you sure you want to delete this shift?',
      reallyDelete,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true
      }
    );
  }, [rows, load, showConfirm, showToast]);

  const handleUndo = useCallback(async () => {
    if (!lastDeleted) return;
    const r = lastDeleted;
    // Reinsert without id (DB will assign a new id)
    await insertShift({
      date: r.date,
      shift_type: r.shift_type,
      hours_worked: r.hours_worked,
      cash_tips: r.cash_tips,
      card_tips: r.card_tips,
      tip_out_basis: r.tip_out_basis,
      tip_out_percent: r.tip_out_percent,
      sales: r.sales,
      tip_out_override_amount: r.tip_out_override_amount,
      base_hourly_wage: r.base_hourly_wage,
      notes: r.notes,
    } as any);
    setUndoVisible(false);
    setLastDeleted(null);
    showToast('Shift restored successfully! ↩️', 'success');
    await load();
  }, [lastDeleted, load, showToast]);

  const renderRightActions = (id: string) => (
    <Pressable
      onPress={() => {
        console.log('Delete button pressed for ID:', id);
        confirmAndDelete(id);
      }}
      style={{
        width: 96,
        backgroundColor: '#b00020',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '700' }}>Delete</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: Row }) => {
    const m = computeShiftMetrics({
      hours_worked: item.hours_worked,
      cash_tips: item.cash_tips,
      card_tips: item.card_tips,
      base_hourly_wage: item.base_hourly_wage,
      tip_out_basis: item.tip_out_basis,
      tip_out_percent: item.tip_out_percent,
      sales: item.sales,
      tip_out_override_amount: item.tip_out_override_amount,
    });
    
    const handlePress = () => {
      router.push(`/shift/${item.id}`);
    };
    
    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false} friction={2}>
        <Pressable
          onPress={handlePress}
          onLongPress={() => {
            console.log('Long press detected for shift ID:', item.id);
            confirmAndDelete(item.id);
          }}
          delayLongPress={400}
          style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>
              {item.date} • {item.shift_type}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              <Text>Net tips: ${m.net_tips.toFixed(2)}</Text>
              <Text>Eff/hr: ${m.effective_hourly.toFixed(2)}</Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  if (!loading && rows.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>History</Text>
        </View>
        <EmptyState
          icon="📊"
          title="No shifts yet"
          subtitle="Start tracking your earnings by adding your first shift from the 'Add Shift' tab below."
          tipTitle="💡 Pro tip"
          tipText="Track every shift to see your earning trends and optimize your schedule!"
        />
      </View>
    );
  }

  return (
    <>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>History</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Undo toast */}
      <Modal transparent visible={undoVisible} animationType="fade" onRequestClose={() => setUndoVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 520, borderRadius: 10, padding: 12, backgroundColor: '#333', flexDirection:'row', alignItems:'center', gap:12 }}>
            <Text style={{ color: 'white', flex: 1 }}>Shift deleted</Text>
            <Pressable onPress={handleUndo} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#0a84ff' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Undo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ConfirmDialogComponent />
      <ToastComponent />
    </>
  );
}