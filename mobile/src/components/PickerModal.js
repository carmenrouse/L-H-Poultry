import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from './ui';
import { colors, spacing } from '../theme';

// Simple search-and-select modal used for choosing a supplier or product
// without pulling in an extra native picker dependency.
export default function PickerModal({ visible, title, items, labelKey = 'name', subLabelKey, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const label = String(item[labelKey] || '').toLowerCase();
      const sub = subLabelKey ? String(item[subLabelKey] || '').toLowerCase() : '';
      return label.includes(q) || sub.includes(q);
    });
  }, [items, query, labelKey, subLabelKey]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Input placeholder="Search..." value={query} onChangeText={setQuery} autoFocus />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item);
                setQuery('');
              }}
            >
              <Text style={styles.rowLabel}>{item[labelKey]}</Text>
              {subLabelKey && <Text style={styles.rowSub}>{item[subLabelKey]}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No matches.</Text>}
        />
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: spacing.xl },
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 16, color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  closeButton: { paddingVertical: spacing.md, alignItems: 'center' },
  closeButtonText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
});
