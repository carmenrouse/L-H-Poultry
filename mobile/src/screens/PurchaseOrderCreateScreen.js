import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import client, { apiErrorMessage } from '../api/client';
import { Button, Card, ErrorText, Input, Screen } from '../components/ui';
import PickerModal from '../components/PickerModal';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

export default function PurchaseOrderCreateScreen({ navigation }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [poNumber, setPoNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([client.get('/suppliers'), client.get('/products')]);
        setSuppliers(s.data);
        setProducts(p.data);
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    })();
  }, []);

  function addProduct(product) {
    setProductPickerOpen(false);
    if (lines.some((l) => l.productId === product.id)) return;
    setLines((prev) => [
      ...prev,
      { productId: product.id, name: product.name, sku: product.sku, quantityOrdered: '1', unitCost: String(product.cost) },
    ]);
  }

  function updateLine(productId, field, value) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l)));
  }

  function removeLine(productId) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.unitCost) || 0) * (parseInt(l.quantityOrdered, 10) || 0), 0);
  const canSave = supplier && lines.length > 0 && lines.every((l) => Number(l.quantityOrdered) > 0);

  async function save(submit) {
    setError('');
    setSaving(true);
    try {
      const payload = {
        supplierId: supplier.id,
        poNumber: poNumber || undefined,
        submit,
        lineItems: lines.map((l) => ({
          productId: l.productId,
          quantityOrdered: parseInt(l.quantityOrdered, 10),
          unitCost: parseFloat(l.unitCost) || 0,
        })),
      };
      const { data } = await client.post('/purchase-orders', payload);
      navigation.replace('PurchaseOrderDetail', { poId: data.id });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <ErrorText text={error} />

        <Pressable style={styles.selectField} onPress={() => setSupplierPickerOpen(true)}>
          <Text style={styles.selectLabel}>Supplier</Text>
          <Text style={styles.selectValue}>{supplier ? supplier.name : 'Choose a supplier...'}</Text>
        </Pressable>

        <Input label="PO number (optional)" value={poNumber} onChangeText={setPoNumber} placeholder="PO-1002" />

        <Card>
          <Text style={styles.sectionTitle}>Line items</Text>
          {lines.map((l) => (
            <View key={l.productId} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{l.name}</Text>
                <Text style={styles.lineSub}>SKU {l.sku}</Text>
              </View>
              <Input
                style={styles.lineInput}
                keyboardType="number-pad"
                value={l.quantityOrdered}
                onChangeText={(v) => updateLine(l.productId, 'quantityOrdered', v)}
              />
              <Input
                style={styles.lineInput}
                keyboardType="decimal-pad"
                value={l.unitCost}
                onChangeText={(v) => updateLine(l.productId, 'unitCost', v)}
              />
              <Pressable onPress={() => removeLine(l.productId)} style={styles.removeButton}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Button title="+ Add product" variant="secondary" onPress={() => setProductPickerOpen(true)} />
        </Card>

        <Text style={styles.total}>Estimated total: {formatMoney(total)}</Text>

        <Button title="Save as draft" variant="secondary" onPress={() => save(false)} disabled={!canSave} loading={saving} style={{ marginBottom: spacing.sm }} />
        <Button title="Save and submit to supplier" onPress={() => save(true)} disabled={!canSave} loading={saving} />
      </ScrollView>

      <PickerModal
        visible={supplierPickerOpen}
        title="Choose supplier"
        items={suppliers}
        onSelect={(s) => {
          setSupplier(s);
          setSupplierPickerOpen(false);
        }}
        onClose={() => setSupplierPickerOpen(false)}
      />
      <PickerModal
        visible={productPickerOpen}
        title="Add product"
        items={products}
        subLabelKey="sku"
        onSelect={addProduct}
        onClose={() => setProductPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectField: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  selectValue: { fontSize: 16, color: colors.text },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  lineName: { fontWeight: '600', color: colors.text },
  lineSub: { color: colors.textMuted, fontSize: 12 },
  lineInput: { width: 64, marginBottom: 0 },
  removeButton: { padding: spacing.xs },
  total: { textAlign: 'right', fontWeight: '700', fontSize: 16, marginVertical: spacing.md },
});
