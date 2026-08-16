import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import client, { apiErrorMessage } from '../api/client';
import { Button, Card, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

export default function ReceiveInventoryScreen({ route, navigation }) {
  const { poId } = route.params;
  const [po, setPo] = useState(null);
  const [rows, setRows] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.get(`/purchase-orders/${poId}`);
        setPo(data);
        const initial = {};
        for (const li of data.lineItems) {
          const remaining = li.quantityOrdered - li.quantityReceived;
          if (remaining > 0) {
            initial[li.id] = { quantity: String(remaining), overrideCost: false, unitCost: String(li.unitCost) };
          }
        }
        setRows(initial);
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    })();
  }, [poId]);

  function updateRow(lineItemId, field, value) {
    setRows((prev) => ({ ...prev, [lineItemId]: { ...prev[lineItemId], [field]: value } }));
  }

  async function onReceive() {
    setError('');
    const lines = Object.entries(rows)
      .filter(([, r]) => parseInt(r.quantity, 10) > 0)
      .map(([lineItemId, r]) => ({
        lineItemId,
        quantityReceived: parseInt(r.quantity, 10),
        unitCost: r.overrideCost ? parseFloat(r.unitCost) || 0 : undefined,
      }));
    if (lines.length === 0) {
      setError('Enter a quantity to receive for at least one line.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await client.post(`/purchase-orders/${poId}/receive`, { lines });
      if (data.variances.length > 0) {
        Alert.alert(
          'Cost variance flagged',
          `${data.variances.length} line(s) were received at a different cost than the PO expected.`
        );
      }
      navigation.replace('PurchaseOrderDetail', { poId });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!po) {
    return (
      <Screen style={{ padding: spacing.md }}>
        <ErrorText text={error} />
      </Screen>
    );
  }

  const remainingLines = po.lineItems.filter((li) => li.quantityOrdered > li.quantityReceived);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <ErrorText text={error} />
        {remainingLines.map((li) => {
          const row = rows[li.id] || { quantity: '0', overrideCost: false, unitCost: String(li.unitCost) };
          const remaining = li.quantityOrdered - li.quantityReceived;
          return (
            <Card key={li.id}>
              <Text style={styles.name}>{li.product.name}</Text>
              <Text style={styles.meta}>
                Ordered {li.quantityOrdered} · Already received {li.quantityReceived} · PO cost {formatMoney(li.unitCost)}
              </Text>
              <Input
                label={`Receive now (max ${remaining})`}
                keyboardType="number-pad"
                value={row.quantity}
                onChangeText={(v) => updateRow(li.id, 'quantity', v)}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Received at a different cost?</Text>
                <Switch value={row.overrideCost} onValueChange={(v) => updateRow(li.id, 'overrideCost', v)} />
              </View>
              {row.overrideCost && (
                <Input
                  label="Actual unit cost"
                  keyboardType="decimal-pad"
                  value={row.unitCost}
                  onChangeText={(v) => updateRow(li.id, 'unitCost', v)}
                />
              )}
            </Card>
          );
        })}
        <Button title="Confirm receipt" onPress={onReceive} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '700', fontSize: 15, color: colors.text, marginBottom: 2 },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  switchLabel: { color: colors.text },
});
