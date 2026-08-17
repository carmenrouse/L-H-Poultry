import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import client, { apiErrorMessage } from '../api/client';
import { Badge, Button, EmptyState, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

export default function POSScreen({ navigation }) {
  const [business, setBusiness] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // [{productId, name, price, quantityOnHand, quantity}]
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [charging, setCharging] = useState(false);
  const [lastScan, setLastScan] = useState(0);

  useEffect(() => {
    client
      .get('/business')
      .then(({ data }) => setBusiness(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      client
        .get('/products', { params: { search } })
        .then(({ data }) => setResults(data))
        .catch((err) => setError(apiErrorMessage(err)));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function addToCart(product) {
    setSearch('');
    setResults([]);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, price: Number(product.price), quantityOnHand: product.quantityOnHand, quantity: 1 }];
    });
  }

  async function onBarcodeScanned({ data }) {
    const now = Date.now();
    if (now - lastScan < 1500) return; // debounce repeated scans of the same code
    setLastScan(now);
    try {
      const { data: products } = await client.get('/products', { params: { barcode: data } });
      if (products.length === 0) {
        Alert.alert('Not found', `No product with barcode ${data}`);
        return;
      }
      addToCart(products[0]);
    } catch (err) {
      Alert.alert('Lookup failed', apiErrorMessage(err));
    }
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const taxRate = business ? Number(business.taxRate) : 0;
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxTotal;

  async function checkout() {
    setError('');
    setCharging(true);
    try {
      const { data } = await client.post('/sales', {
        paymentMethod,
        lineItems: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      setCart([]);
      const warningText = data.warnings.length ? `\n\n${data.warnings.join('\n')}` : '';
      Alert.alert('Sale complete', `Total: ${formatMoney(data.sale.total)}${warningText}`, [
        { text: 'View receipt', onPress: () => navigation.navigate('SaleDetail', { saleId: data.sale.id }) },
        { text: 'New sale', style: 'cancel' },
      ]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCharging(false);
    }
  }

  if (showScanner) {
    if (!permission?.granted) {
      return (
        <Screen style={styles.center}>
          <Text style={{ marginBottom: spacing.md }}>Camera access is needed to scan barcodes.</Text>
          <Button title="Grant camera access" onPress={requestPermission} />
          <Button title="Cancel" variant="secondary" onPress={() => setShowScanner(false)} style={{ marginTop: spacing.md }} />
        </Screen>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View style={styles.captureBar}>
          <Button title="Done scanning" onPress={() => setShowScanner(false)} />
        </View>
      </View>
    );
  }

  return (
    <Screen style={{ padding: spacing.md }}>
      <View style={styles.searchRow}>
        <Input style={{ flex: 1, marginBottom: 0 }} placeholder="Search products..." value={search} onChangeText={setSearch} />
        <Pressable style={styles.scanButton} onPress={() => setShowScanner(true)}>
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </Pressable>
      </View>

      {results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((p) => (
            <Pressable key={p.id} style={styles.resultRow} onPress={() => addToCart(p)}>
              <Text style={{ flex: 1 }}>{p.name}</Text>
              <Text style={styles.resultPrice}>{formatMoney(p.price)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ErrorText text={error} />

      <FlatList
        data={cart}
        keyExtractor={(item) => item.productId}
        ListEmptyComponent={<EmptyState text="Cart is empty. Search or scan to add items." />}
        renderItem={({ item }) => (
          <View style={styles.cartRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartName}>{item.name}</Text>
              <Text style={styles.cartPrice}>{formatMoney(item.price)} ea</Text>
              {item.quantity > item.quantityOnHand && <Badge text="Exceeds stock on hand" tone="warning" />}
            </View>
            <View style={styles.qtyControls}>
              <Pressable onPress={() => changeQty(item.productId, -1)} style={styles.qtyButton}>
                <Text style={styles.qtyButtonText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <Pressable onPress={() => changeQty(item.productId, 1)} style={styles.qtyButton}>
                <Text style={styles.qtyButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(item.price * item.quantity)}</Text>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text>{formatMoney(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text>{formatMoney(taxTotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatMoney(total)}</Text>
        </View>

        <View style={styles.paymentRow}>
          {['CASH', 'CARD'].map((method) => (
            <Pressable
              key={method}
              style={[styles.paymentChip, paymentMethod === method && styles.paymentChipActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={[styles.paymentChipText, paymentMethod === method && styles.paymentChipTextActive]}>{method}</Text>
            </Pressable>
          ))}
        </View>

        <Button title={`Charge ${formatMoney(total)}`} onPress={checkout} disabled={cart.length === 0} loading={charging} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  scanButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 14 },
  scanButtonText: { color: '#fff', fontWeight: '700' },
  resultsBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: spacing.sm, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultPrice: { fontWeight: '700' },
  cartRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
  cartName: { fontWeight: '600', color: colors.text },
  cartPrice: { color: colors.textMuted, fontSize: 12 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md },
  qtyButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { fontSize: 18, fontWeight: '700', color: colors.text },
  qtyValue: { width: 28, textAlign: 'center', fontWeight: '700' },
  lineTotal: { fontWeight: '700', width: 70, textAlign: 'right' },
  summary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  summaryLabel: { color: colors.textMuted },
  summaryTotalLabel: { fontWeight: '700', fontSize: 16 },
  summaryTotalValue: { fontWeight: '800', fontSize: 18, color: colors.primaryDark },
  paymentRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  paymentChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  paymentChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentChipText: { fontWeight: '600', color: colors.text },
  paymentChipTextActive: { color: '#fff' },
  captureBar: { padding: spacing.md, backgroundColor: colors.background },
});
