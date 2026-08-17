import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage } from '../api/client';
import { Badge, EmptyState, ErrorText, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime, formatMoney } from '../utils/status';

export default function SalesHistoryScreen({ navigation }) {
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get('/sales');
      setSales(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen style={{ padding: spacing.md }}>
      <ErrorText text={error} />
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={!loading ? <EmptyState text="No sales yet." /> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('SaleDetail', { saleId: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.total}>{formatMoney(item.total)}</Text>
              <Text style={styles.meta}>
                {formatDateTime(item.createdAt)} · {item.staff.name} · {item.lineItems.length} items
              </Text>
            </View>
            <Badge text={item.paymentMethod} tone={item.paymentMethod === 'CASH' ? 'success' : 'info'} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  total: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
