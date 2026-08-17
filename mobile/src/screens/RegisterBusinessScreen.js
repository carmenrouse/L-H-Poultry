import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { Button, ErrorText, Input, Screen } from '../components/ui';
import { spacing } from '../theme';

export default function RegisterBusinessScreen({ navigation }) {
  const { registerBusiness } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = businessName && ownerName && email && password.length >= 8;

  async function onSubmit() {
    setError('');
    setLoading(true);
    const result = await registerBusiness({ businessName, ownerName, email: email.trim(), password });
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your business</Text>
          <Text style={styles.subtitle}>You'll be the Owner account and can add staff later.</Text>

          <ErrorText text={error} />
          <Input label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="L&H Poultry" />
          <Input label="Your name" value={ownerName} onChangeText={setOwnerName} placeholder="Jane Owner" />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@business.com"
          />
          <Input
            label="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button title="Create business" onPress={onSubmit} loading={loading} disabled={!canSubmit} />
          <Button title="Back to login" onPress={() => navigation.goBack()} variant="secondary" style={{ marginTop: spacing.md }} />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: spacing.lg },
});
