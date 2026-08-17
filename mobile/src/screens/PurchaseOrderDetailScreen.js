import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage, UPLOADS_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, ErrorText, Screen } from '../components/ui';
import { spacing, colors } from '../theme';
import { formatDate, formatMoney, poStatusTone } from '../utils/status';

export default function PurchaseOrderDetailScreen({ route, navigation }) {
  const { poId } = route.params;
  const { hasRole } = useAuth();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client.get(`/purchase-orders/${poId}`);
      setPo(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [poId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function submit() {
    setBusy(true);
    try {
      await client.post(`/purchase-orders/${poId}/submit`);
      load();
    } catch (err) {
      Alert.alert('Could not submit', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    Alert.alert('Cancel purchase order?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel it',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await client.post(`/purchase-orders/${poId}/cancel`);
            load();
          } catch (err) {
            Alert.alert('Could not cancel', apiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (!po) {
    return (
      <Screen style={{ padding: spacing.md }}>
        <ErrorText text={error} />
      </Screen>
    );
  }

  const canManage = hasRole('MANAGER');
  const canReceive = canManage && ['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(po.status);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <ErrorText text={error} />
        <Card>
          <View style={styles.headerRow}>
            <Text style={styles.supplier}>{po.supplier.name}</Text>
            <Badge text={po.status.replace('_', ' ')} tone={poStatusTone(po.status)} />
          </View>
          <Text style={styles.meta}>{po.poNumber || po.id.slice(0, 8)} · created {formatDate(po.createdAt)}</Text>
          {po.expectedDate && <Text style={styles.meta}>Expected {formatDate(po.expectedDate)}</Text>}
          {po.source === 'SCANNED' && <Badge text="Created from scan" tone="info" />}
          {po.notes ? <Text style={styles.notes}>{po.notes}</Text> : null}
        </Card>

        {po.scanAttachmentUrl && (
          <Card>
            <Text style={styles.sectionTitle}>Scanned document</Text>
            <Image source={{ uri: `${UPLOADS_BASE_URL}${po.scanAttachmentUrl}` }} style={styles.scanImage} resizeMode="contain" />
          </Card>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Line items</Text>
          {po.lineItems.map((li) => (
            <View key={li.id} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{li.product.name}</Text>
                <Text style={styles.lineSub}>
                  {li.quantityReceived}/{li.quantityOrdered} received · {formatMoney(li.unitCost)} ea
                  {li.receivedUnitCost && Number(li.receivedUnitCost) !== Number(li.unitCost)
                    ? ` (received @ ${formatMoney(li.receivedUnitCost)})`
                    : ''}
                </Text>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(li.unitCost * li.quantityOrdered)}</Text>
            </View>
          ))}
        </Card>

        {canManage && po.status === 'DRAFT' && (
          <Button title="Submit to supplier" onPress={submit} loading={busy} style={{ marginBottom: spacing.sm }} />
        )}
        {canReceive && (
          <Button
            title="Receive inventory"
            onPress={() => navigation.navigate('ReceiveInventory', { poId })}
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {canManage && ['DRAFT', 'SUBMITTED'].includes(po.status) && (
          <Button title="Cancel purchase order" variant="danger" onPress={cancel} loading={busy} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  supplier: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  notes: { marginTop: spacing.sm, color: colors.text },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: spacing.sm },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineName: { fontWeight: '600', color: colors.text },
  lineSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  lineTotal: { fontWeight: '700', color: colors.text },
  scanImage: { width: '100%', height: 300, borderRadius: 8, backgroundColor: '#eee' },
});
