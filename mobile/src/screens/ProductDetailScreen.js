import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import client, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, ErrorText, Input, Screen } from '../components/ui';
import { spacing } from '../theme';

const emptyForm = {
  sku: '', name: '', description: '', cost: '', price: '',
  quantityOnHand: '0', reorderPoint: '0', category: '', barcode: '',
};

export default function ProductDetailScreen({ route, navigation }) {
  const productId = route.params?.productId ?? null;
  const isNew = !productId;
  const { hasRole } = useAuth();
  const canEdit = hasRole('MANAGER');

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('');

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await client.get(`/products/${productId}`);
      setForm({
        sku: data.sku,
        name: data.name,
        description: data.description || '',
        cost: String(data.cost),
        price: String(data.price),
        quantityOnHand: String(data.quantityOnHand),
        reorderPoint: String(data.reorderPoint),
        category: data.category || '',
        barcode: data.barcode || '',
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [productId, isNew]);

  useEffect(() => {
    load();
    navigation.setOptions({ title: isNew ? 'New product' : 'Product' });
  }, [load, navigation, isNew]);

  async function onSave() {
    setError('');
    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description || undefined,
        cost: parseFloat(form.cost) || 0,
        price: parseFloat(form.price) || 0,
        category: form.category || undefined,
        barcode: form.barcode || undefined,
      };
      if (isNew) {
        payload.quantityOnHand = parseInt(form.quantityOnHand, 10) || 0;
        payload.reorderPoint = parseInt(form.reorderPoint, 10) || 0;
        const { data } = await client.post('/products', payload);
        navigation.replace('ProductDetail', { productId: data.id });
      } else {
        payload.reorderPoint = parseInt(form.reorderPoint, 10) || 0;
        await client.patch(`/products/${productId}`, payload);
        navigation.goBack();
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onAdjust() {
    const delta = parseInt(adjustDelta, 10);
    if (!delta) return;
    try {
      await client.post(`/products/${productId}/adjust`, { delta, note: 'Manual correction via mobile app' });
      setAdjustDelta('');
      load();
    } catch (err) {
      Alert.alert('Adjustment failed', apiErrorMessage(err));
    }
  }

  if (loading) return null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <ErrorText text={error} />
        <Input label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} editable={canEdit} />
        <Input label="SKU" value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} editable={canEdit} />
        <Input label="Barcode" value={form.barcode} onChangeText={(v) => setForm((f) => ({ ...f, barcode: v }))} editable={canEdit} />
        <Input label="Category" value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} editable={canEdit} />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          editable={canEdit}
          multiline
        />
        <View style={styles.row}>
          <Input
            label="Cost"
            style={{ flex: 1 }}
            keyboardType="decimal-pad"
            value={form.cost}
            onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))}
            editable={canEdit}
          />
          <View style={{ width: spacing.md }} />
          <Input
            label="Price"
            style={{ flex: 1 }}
            keyboardType="decimal-pad"
            value={form.price}
            onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
            editable={canEdit}
          />
        </View>
        <Input
          label="Reorder point"
          keyboardType="number-pad"
          value={form.reorderPoint}
          onChangeText={(v) => setForm((f) => ({ ...f, reorderPoint: v }))}
          editable={canEdit}
        />
        {isNew && (
          <Input
            label="Starting quantity on hand"
            keyboardType="number-pad"
            value={form.quantityOnHand}
            onChangeText={(v) => setForm((f) => ({ ...f, quantityOnHand: v }))}
          />
        )}

        {canEdit && <Button title={isNew ? 'Create product' : 'Save changes'} onPress={onSave} loading={saving} />}

        {!isNew && canEdit && (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionTitle}>Stock on hand: {form.quantityOnHand}</Text>
            <Text style={styles.helpText}>
              Positive to add, negative to remove (e.g. damage/loss). Use Purchase Orders to receive stock instead.
            </Text>
            <View style={styles.row}>
              <Input
                style={{ flex: 1 }}
                placeholder="e.g. -2"
                keyboardType="numbers-and-punctuation"
                value={adjustDelta}
                onChangeText={setAdjustDelta}
              />
              <View style={{ width: spacing.md }} />
              <Button title="Adjust" variant="secondary" onPress={onAdjust} style={{ paddingHorizontal: spacing.lg }} />
            </View>
          </Card>
        )}

        {!isNew && hasRole('OWNER') && (
          <Button
            title="Manage web listings"
            variant="secondary"
            onPress={() => navigation.navigate('WebListings', { productId })}
            style={{ marginTop: spacing.md }}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: spacing.xs },
  helpText: { color: '#6b7280', fontSize: 13, marginBottom: spacing.md },
});
