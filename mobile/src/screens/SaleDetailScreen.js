import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import client, { apiErrorMessage } from '../api/client';
import { Card, ErrorText, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime, formatMoney } from '../utils/status';

export default function SaleDetailScreen({ route }) {
  const { saleId } = route.params;
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get(`/sales/${saleId}`)
      .then(({ data }) => setSale(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [saleId]);

  if (!sale) {
    return (
      <Screen style={{ padding: spacing.md }}>
        <ErrorText text={error} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          <Text style={styles.header}>Receipt</Text>
          <Text style={styles.meta}>{formatDateTime(sale.createdAt)}</Text>
          <Text style={styles.meta}>Sold by {sale.staff.name} · {sale.paymentMethod}</Text>
        </Card>

        <Card>
          {sale.lineItems.map((li) => (
            <View key={li.id} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{li.product.name}</Text>
                <Text style={styles.lineSub}>{li.quantity} × {formatMoney(li.priceAtSale)}</Text>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(li.priceAtSale * li.quantity)}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text>{formatMoney(sale.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text>{formatMoney(sale.taxTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatMoney(sale.total)}</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  meta: { color: colors.textMuted, fontSize: 13 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineName: { fontWeight: '600', color: colors.text },
  lineSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  lineTotal: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  summaryLabel: { color: colors.textMuted },
  summaryTotalLabel: { fontWeight: '700', fontSize: 16 },
  summaryTotalValue: { fontWeight: '800', fontSize: 18, color: colors.primaryDark },
});
