import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import client, { apiErrorMessage } from '../api/client';
import { Button, Card, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';

// Must match backend MAPPABLE_FIELDS (src/services/webExport/genericRestAdapter.js).
const INTERNAL_FIELDS = ['sku', 'name', 'description', 'price', 'cost', 'quantityOnHand', 'images', 'category', 'barcode'];

export default function WebExportConfigScreen({ route, navigation }) {
  const configId = route.params?.configId ?? null;
  const isNew = !configId;

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState('bearer');
  const [authHeaderName, setAuthHeaderName] = useState('Authorization');
  const [authToken, setAuthToken] = useState('');
  const [mappingRows, setMappingRows] = useState([{ externalField: 'name', internalField: 'name' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    client
      .get('/web-export/configs')
      .then(({ data }) => {
        const config = data.find((c) => c.id === configId);
        if (!config) return;
        setName(config.name);
        setBaseUrl(config.baseUrl);
        setAuthType(config.authType);
        setAuthHeaderName(config.authHeaderName);
        setMappingRows(
          Object.entries(config.fieldMapping).map(([externalField, internalField]) => ({ externalField, internalField }))
        );
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [configId, isNew]);

  function updateRow(index, patch) {
    setMappingRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setMappingRows((prev) => [...prev, { externalField: '', internalField: 'name' }]);
  }

  function removeRow(index) {
    setMappingRows((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave = name && baseUrl && (isNew ? authToken : true) && mappingRows.every((r) => r.externalField);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const fieldMapping = {};
      for (const row of mappingRows) fieldMapping[row.externalField] = row.internalField;
      const payload = { name, baseUrl, authType, authHeaderName, fieldMapping };
      if (authToken) payload.authToken = authToken;

      if (isNew) {
        await client.post('/web-export/configs', payload);
      } else {
        await client.patch(`/web-export/configs/${configId}`, payload);
      }
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await client.delete(`/web-export/configs/${configId}`);
      navigation.goBack();
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
        <Input label="Destination name" value={name} onChangeText={setName} placeholder="My storefront" />
        <Input label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="https://api.example.com/products" autoCapitalize="none" />

        <Text style={styles.label}>Auth type</Text>
        <View style={styles.authTypeRow}>
          {['bearer', 'apiKey'].map((t) => (
            <Pressable key={t} style={[styles.chip, authType === t && styles.chipActive]} onPress={() => setAuthType(t)}>
              <Text style={[styles.chipText, authType === t && styles.chipTextActive]}>{t === 'bearer' ? 'Bearer token' : 'API key header'}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Auth header name" value={authHeaderName} onChangeText={setAuthHeaderName} placeholder={authType === 'apiKey' ? 'X-API-Key' : 'Authorization'} />
        <Input
          label={isNew ? 'Auth token / key' : 'Auth token / key (leave blank to keep current)'}
          value={authToken}
          onChangeText={setAuthToken}
          secureTextEntry
        />

        <Card>
          <Text style={styles.sectionTitle}>Field mapping</Text>
          <Text style={styles.helpText}>Map each field the external API expects to a field on your products.</Text>
          {mappingRows.map((row, i) => (
            <View key={i} style={styles.mappingRow}>
              <Input
                style={{ flex: 1, marginBottom: 0 }}
                placeholder="external field, e.g. title"
                value={row.externalField}
                onChangeText={(v) => updateRow(i, { externalField: v })}
              />
              <Text style={styles.arrow}>←</Text>
              <View style={styles.internalFieldPicker}>
                {INTERNAL_FIELDS.map((f) => (
                  <Pressable key={f} onPress={() => updateRow(i, { internalField: f })} style={[styles.fieldChip, row.internalField === f && styles.fieldChipActive]}>
                    <Text style={[styles.fieldChipText, row.internalField === f && styles.fieldChipTextActive]}>{f}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => removeRow(i)}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Button title="+ Add field mapping" variant="secondary" onPress={addRow} />
        </Card>

        <Button title={isNew ? 'Create destination' : 'Save changes'} onPress={save} disabled={!canSave} loading={saving} style={{ marginBottom: spacing.sm }} />
        {!isNew && <Button title="Delete destination" variant="danger" onPress={remove} loading={saving} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, marginBottom: spacing.xs, fontSize: 13, fontWeight: '600' },
  authTypeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: spacing.xs },
  helpText: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  mappingRow: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  arrow: { textAlign: 'center', color: colors.textMuted, marginVertical: spacing.xs },
  internalFieldPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  fieldChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  fieldChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  fieldChipText: { fontSize: 11, color: colors.textMuted },
  fieldChipTextActive: { color: '#fff' },
});
