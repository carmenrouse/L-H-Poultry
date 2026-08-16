import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage } from '../api/client';
import { Badge, Button, Card, EmptyState, ErrorText, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime } from '../utils/status';

function statusTone(status) {
  if (status === 'SYNCED') return 'success';
  if (status === 'ERROR') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'default';
}

export default function WebListingsScreen({ route }) {
  const { productId } = route.params;
  const [configs, setConfigs] = useState([]);
  const [listingsByConfig, setListingsByConfig] = useState({});
  const [error, setError] = useState('');
  const [pushingConfigId, setPushingConfigId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [configsRes, listingsRes] = await Promise.all([
        client.get('/web-export/configs'),
        client.get('/web-export/listings', { params: { productId } }),
      ]);
      setConfigs(configsRes.data);
      const byConfig = {};
      for (const listing of listingsRes.data) byConfig[listing.configId] = listing;
      setListingsByConfig(byConfig);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function push(configId) {
    setPushingConfigId(configId);
    try {
      await client.post('/web-export/push', { productId, configId });
      load();
    } catch (err) {
      Alert.alert('Push failed', apiErrorMessage(err));
    } finally {
      setPushingConfigId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <ErrorText text={error} />
        {configs.length === 0 && <EmptyState text="No web export destinations configured. Add one in Settings." />}
        {configs.map((config) => {
          const listing = listingsByConfig[config.id];
          return (
            <Card key={config.id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{config.name}</Text>
                <Badge text={listing ? listing.syncStatus : 'NOT_SYNCED'} tone={statusTone(listing?.syncStatus)} />
              </View>
              <Text style={styles.meta}>{config.baseUrl}</Text>
              {listing?.lastSyncedAt && <Text style={styles.meta}>Last synced {formatDateTime(listing.lastSyncedAt)}</Text>}
              {listing?.lastError && <Text style={styles.errorText}>{listing.lastError}</Text>}
              <Button
                title="Push to web"
                onPress={() => push(config.id)}
                loading={pushingConfigId === config.id}
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  name: { fontWeight: '700', fontSize: 15, color: colors.text },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
});
