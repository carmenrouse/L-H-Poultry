import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, EmptyState, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

export default function ProductsScreen({ navigation }) {
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get('/products', { params: query ? { search: query } : {} });
      setProducts(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
    }, [load])
  );

  return (
    <Screen style={{ padding: spacing.md }}>
      <Input
        placeholder="Search by name, SKU, or barcode"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load(search)}
        returnKeyType="search"
      />
      {hasRole('MANAGER') && (
        <Button
          title="+ Add product"
          variant="secondary"
          onPress={() => navigation.navigate('ProductDetail', { productId: null })}
          style={{ marginBottom: spacing.md }}
        />
      )}
      <ErrorText text={error} />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => load(search)}
        ListEmptyComponent={!loading ? <EmptyState text="No products found." /> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sku}>SKU {item.sku}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{formatMoney(item.price)}</Text>
              <Badge
                text={`${item.quantityOnHand} in stock`}
                tone={item.quantityOnHand <= item.reorderPoint ? 'warning' : 'default'}
              />
            </View>
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
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sku: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  price: { fontSize: 16, fontWeight: '700', color: colors.primaryDark, marginBottom: 4 },
});
