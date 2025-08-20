import { View, Text, Pressable } from 'react-native';

export type RangeKey = '7d' | '30d' | 'all';
export type ShiftKey = 'all' | 'Brunch' | 'Lunch' | 'Dinner';

export function FilterBar({
  range, setRange,
  shift, setShift,
}: {
  range: RangeKey; setRange: (v: RangeKey) => void;
  shift: ShiftKey; setShift: (v: ShiftKey) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {/* Range row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['7d','30d','all'] as RangeKey[]).map(k => (
          <Pressable
            key={k}
            onPress={() => setRange(k)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18,
              backgroundColor: range === k ? '#2f95dc' : '#f0f0f0'
            }}
          >
            <Text style={{ color: range === k ? 'white' : 'black' }}>
              {k === '7d' ? 'Last 7 days' : k === '30d' ? 'Last 30 days' : 'All time'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Shift type row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all','Brunch','Lunch','Dinner'] as ShiftKey[]).map(k => (
          <Pressable
            key={k}
            onPress={() => setShift(k)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18,
              backgroundColor: shift === k ? '#2f95dc' : '#f0f0f0'
            }}
          >
            <Text style={{ color: shift === k ? 'white' : 'black' }}>
              {k === 'all' ? 'All shifts' : k}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}