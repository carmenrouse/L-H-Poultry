import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime } from '../utils/status';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [business, setBusiness] = useState(null);
  const [taxRatePct, setTaxRatePct] = useState('0');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await client.get('/business');
      setBusiness(data);
      setTaxRatePct(String(Number(data.taxRate) * 100));
      setAllowNegativeStock(data.allowNegativeStock);
      const { data: configData } = await client.get('/web-export/configs');
      setConfigs(configData);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveBusiness() {
    setSavingBusiness(true);
    try {
      await client.patch('/business', {
        taxRate: (parseFloat(taxRatePct) || 0) / 100,
        allowNegativeStock,
      });
      load();
    } catch (err) {
      Alert.alert('Could not save', apiErrorMessage(err));
    } finally {
      setSavingBusiness(false);
    }
  }

  async function pushAllProducts(configId) {
    try {
      const { data: products } = await client.get('/products');
      await client.post('/web-export/push-bulk', { configId, productIds: products.map((p) => p.id) });
      Alert.alert('Bulk push started', `Pushed ${products.length} products.`);
      load();
    } catch (err) {
      Alert.alert('Bulk push failed', apiErrorMessage(err));
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={styles.userLine}>{user?.name} · {user?.role}</Text>
        <ErrorText text={error} />

        <Card>
          <Text style={styles.sectionTitle}>Business settings</Text>
          <Input label="Sales tax rate (%)" keyboardType="decimal-pad" value={taxRatePct} onChangeText={setTaxRatePct} />
          <View style={styles.switchRow}>
            <Text style={{ color: colors.text }}>Allow selling below zero stock</Text>
            <Switch value={allowNegativeStock} onValueChange={setAllowNegativeStock} />
          </View>
          <Button title="Save business settings" onPress={saveBusiness} loading={savingBusiness} />
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Web export destinations</Text>
          </View>
          {configs.length === 0 && <Text style={styles.helpText}>No destinations configured yet.</Text>}
          {configs.map((c) => (
            <View key={c.id} style={styles.configRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configName}>{c.name}</Text>
                <Text style={styles.configUrl}>{c.baseUrl}</Text>
              </View>
              <Button title="Push all" variant="secondary" onPress={() => pushAllProducts(c.id)} style={styles.pushAllButton} />
            </View>
          ))}
          <Button
            title="+ Add web export destination"
            variant="secondary"
            onPress={() => navigation.navigate('WebExportConfig', { configId: null })}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        <Button title="Log out" variant="danger" onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userLine: { color: colors.textMuted, marginBottom: spacing.md },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helpText: { color: colors.textMuted, marginBottom: spacing.sm },
  configRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  configName: { fontWeight: '600', color: colors.text },
  configUrl: { color: colors.textMuted, fontSize: 12 },
  pushAllButton: { paddingHorizontal: spacing.md },
});
