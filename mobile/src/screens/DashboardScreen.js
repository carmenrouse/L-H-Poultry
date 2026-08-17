import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import client, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, ErrorText, Screen } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/status';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [products, openPOs, todaysSales] = await Promise.all([
        client.get('/products'),
        client.get('/purchase-orders', { params: { status: 'SUBMITTED' } }),
        client.get('/sales'),
      ]);
      const lowStock = products.data.filter((p) => p.quantityOnHand <= p.reorderPoint);
      const todayStr = new Date().toDateString();
      const today = todaysSales.data.filter((s) => new Date(s.createdAt).toDateString() === todayStr);
      const todayTotal = today.reduce((sum, s) => sum + Number(s.total), 0);
      setStats({
        productCount: products.data.length,
        lowStockCount: lowStock.length,
        openPOCount: openPOs.data.length,
        todaySalesCount: today.length,
        todayTotal,
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.greeting}>Hi, {user?.name}</Text>
        <Text style={styles.role}>{user?.role}</Text>
        <ErrorText text={error} />

        {stats && (
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{formatMoney(stats.todayTotal)}</Text>
              <Text style={styles.statLabel}>Today's sales ({stats.todaySalesCount})</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{stats.lowStockCount}</Text>
              <Text style={styles.statLabel}>Low stock items</Text>
            </Card>
          </View>
        )}
        {stats && (
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{stats.productCount}</Text>
              <Text style={styles.statLabel}>Active products</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{stats.openPOCount}</Text>
              <Text style={styles.statLabel}>Open purchase orders</Text>
            </Card>
          </View>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Button title="Start a sale" onPress={() => navigation.navigate('POSTab')} style={{ marginBottom: spacing.sm }} />
          <Button
            title="View products"
            variant="secondary"
            onPress={() => navigation.navigate('ProductsTab')}
            style={{ marginBottom: spacing.sm }}
          />
          <Button title="Log out" variant="danger" onPress={logout} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.text },
  role: { color: colors.textMuted, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  statLabel: { color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
});
