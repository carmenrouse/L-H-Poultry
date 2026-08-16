import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import client, { apiErrorMessage, UPLOADS_BASE_URL } from '../api/client';
import { Badge, Button, Card, ErrorText, Input, Screen } from '../components/ui';
import PickerModal from '../components/PickerModal';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

// Turns a raw OCR line item into the shape this screen edits.
function toEditableLine(li, index) {
  return {
    key: String(index),
    description: li.description,
    quantity: String(li.quantity ?? 1),
    unitCost: String(li.unitCost ?? 0),
    productId: li.matchedProductId || null,
    productLabel: null, // filled in once products load
    confidence: li.confidence || 0,
    suggestions: li.suggestions || [],
    creatingNew: false,
    newSku: '',
    newName: li.description,
    newPrice: '',
  };
}

export default function ScanReviewScreen({ route, navigation }) {
  const { draft } = route.params;
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [poNumber, setPoNumber] = useState(draft.header?.poNumber || '');
  const [lines, setLines] = useState(draft.lineItems.map(toEditableLine));
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerForLine, setProductPickerForLine] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([client.get('/suppliers'), client.get('/products')]);
        setSuppliers(s.data);
        setProducts(p.data);
        if (draft.header?.matchedSupplierId) {
          const match = s.data.find((x) => x.id === draft.header.matchedSupplierId);
          if (match) setSupplier(match);
        }
        setLines((prev) =>
          prev.map((l) => {
            if (!l.productId) return l;
            const product = p.data.find((x) => x.id === l.productId);
            return product ? { ...l, productLabel: `${product.name} (${product.sku})` } : l;
          })
        );
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    })();
  }, [draft]);

  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function assignProduct(key, product) {
    updateLine(key, { productId: product.id, productLabel: `${product.name} (${product.sku})`, creatingNew: false });
    setProductPickerForLine(null);
  }

  async function createProductForLine(line) {
    setError('');
    try {
      const { data } = await client.post('/products', {
        sku: line.newSku.trim(),
        name: line.newName.trim(),
        price: parseFloat(line.newPrice) || 0,
        cost: parseFloat(line.unitCost) || 0,
        quantityOnHand: 0,
        reorderPoint: 0,
      });
      setProducts((prev) => [...prev, data]);
      assignProduct(line.key, data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const allMatched = lines.length > 0 && lines.every((l) => l.productId);
  const canSave = supplier && allMatched;

  async function save(submit) {
    setError('');
    if (!allMatched) {
      setError('Match or create a product for every line before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierId: supplier.id,
        poNumber: poNumber || undefined,
        source: 'SCANNED',
        scanAttachmentUrl: draft.scanAttachmentUrl,
        scanRawData: draft.rawOcrData,
        submit,
        lineItems: lines.map((l) => ({
          productId: l.productId,
          quantityOrdered: parseInt(l.quantity, 10) || 1,
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
        <Text style={styles.title}>Review scanned purchase order</Text>
        <Text style={styles.subtitle}>OCR is a starting draft — check every line before saving.</Text>
        <ErrorText text={error} />

        {draft.scanAttachmentUrl && (
          <Image source={{ uri: `${UPLOADS_BASE_URL}${draft.scanAttachmentUrl}` }} style={styles.scanImage} resizeMode="contain" />
        )}

        <Pressable style={styles.selectField} onPress={() => setSupplierPickerOpen(true)}>
          <Text style={styles.selectLabel}>Supplier {draft.header?.supplierName ? `(OCR read: "${draft.header.supplierName}")` : ''}</Text>
          <Text style={styles.selectValue}>{supplier ? supplier.name : 'Choose a supplier...'}</Text>
        </Pressable>

        <Input label="PO / invoice number" value={poNumber} onChangeText={setPoNumber} />

        {lines.map((line) => (
          <Card key={line.key}>
            <Text style={styles.ocrText}>OCR read: "{line.description}"</Text>
            <View style={styles.row}>
              <Input label="Quantity" style={{ flex: 1 }} keyboardType="number-pad" value={line.quantity} onChangeText={(v) => updateLine(line.key, { quantity: v })} />
              <View style={{ width: spacing.md }} />
              <Input label="Unit cost" style={{ flex: 1 }} keyboardType="decimal-pad" value={line.unitCost} onChangeText={(v) => updateLine(line.key, { unitCost: v })} />
            </View>

            {line.productId ? (
              <View style={styles.matchedRow}>
                <Badge text="Matched" tone="success" />
                <Text style={styles.matchedLabel}>{line.productLabel}</Text>
                <Pressable onPress={() => setProductPickerForLine(line.key)}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Badge text="Unmatched — needs your input" tone="warning" />
                <Button
                  title="Match to existing product"
                  variant="secondary"
                  onPress={() => setProductPickerForLine(line.key)}
                  style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
                />
                {!line.creatingNew ? (
                  <Button title="Create a new product" variant="secondary" onPress={() => updateLine(line.key, { creatingNew: true })} />
                ) : (
                  <View style={styles.newProductForm}>
                    <Input label="New product name" value={line.newName} onChangeText={(v) => updateLine(line.key, { newName: v })} />
                    <Input label="SKU" value={line.newSku} onChangeText={(v) => updateLine(line.key, { newSku: v })} />
                    <Input label="Sell price" keyboardType="decimal-pad" value={line.newPrice} onChangeText={(v) => updateLine(line.key, { newPrice: v })} />
                    <Button title="Create and use this product" onPress={() => createProductForLine(line)} disabled={!line.newSku || !line.newName} />
                  </View>
                )}
              </View>
            )}
          </Card>
        ))}

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
        visible={!!productPickerForLine}
        title="Match to product"
        items={products}
        subLabelKey="sku"
        onSelect={(p) => assignProduct(productPickerForLine, p)}
        onClose={() => setProductPickerForLine(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: spacing.md },
  scanImage: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#eee', marginBottom: spacing.md },
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
  row: { flexDirection: 'row' },
  ocrText: { fontStyle: 'italic', color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13 },
  matchedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  matchedLabel: { flex: 1, color: colors.text, fontWeight: '600' },
  changeLink: { color: colors.primary, fontWeight: '600' },
  newProductForm: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
