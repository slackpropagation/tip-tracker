import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { computeShiftMetrics } from '../../data/calculations';
import { deleteShift, getShifts, insertShift } from '../../data/db';

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Row | null>(null);
  const undoTimer = (typeof window !== 'undefined') ? (window as any) : ({} as any);
  let undoHandle: any = null;
  
  // Local toast state for this component
  const [localToast, setLocalToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  console.log('HistoryScreen render - rows count:', rows.length);

  const load = useCallback(async () => {
    console.log('load function called');
    setLoading(true);
    try {
      const data = await getShifts();
      console.log('getShifts returned:', data.length, 'shifts');
      data.sort((a: Row, b: Row) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      setRows(data);
      console.log('setRows called with:', data.length, 'shifts');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Local toast function that doesn't persist across navigation
  const showLocalToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    console.log('showLocalToast called with:', { message, type });
    setLocalToast({ visible: true, message, type });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setLocalToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  useEffect(() => { 
    load(); 
  }, [load]);

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
        
        console.log('About to call showLocalToast...');
        showLocalToast('Shift deleted successfully! 🗑️', 'success');
        console.log('showLocalToast called successfully');
        
        console.log('Setting up auto-hide timer');
        // auto-hide after 4s
        try { if (undoHandle) clearTimeout(undoHandle); } catch {}
        undoHandle = undoTimer.setTimeout(() => {
          console.log('Auto-hiding undo modal');
          setUndoVisible(false);
        }, 4000);
        
        console.log('Reloading data after toast');
        await load();
        
        console.log('Delete process completed successfully');
      } catch (error) {
        console.error('Error in reallyDelete:', error);
        showLocalToast('Failed to delete shift', 'error');
      }
    };

    console.log('Showing confirmation dialog');
    console.log('showConfirm function:', showConfirm);
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
  }, [rows, showConfirm, showLocalToast]);

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
            showLocalToast('Shift restored successfully! ↩️', 'success');
    await load();
  }, [lastDeleted, showLocalToast]);

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

  const renderItem = useCallback(({ item }: { item: Row }) => {
    console.log('Rendering shift item:', item.id, item.date);
    
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
      console.log('Navigating to shift detail:', item.id);
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
  }, []);

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
        key={rows.length} // Force re-render when data changes
      />
      
      {/* Local Toast Component */}
      {localToast.visible && (
        <View style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          backgroundColor: localToast.type === 'success' ? '#129e57' : localToast.type === 'error' ? '#cc3344' : '#2f95dc',
          padding: 16,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          zIndex: 1000
        }}>
          <Text style={{ fontSize: 16 }}>
            {localToast.type === 'success' ? '✅' : localToast.type === 'error' ? '❌' : 'ℹ️'}
          </Text>
          <Text style={{
            color: 'white',
            flex: 1,
            fontSize: 14,
            lineHeight: 20
          }}>
            {localToast.message}
          </Text>
        </View>
      )}

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

    </>
  );
}