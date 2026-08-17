import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { Button, ErrorText, Input, Screen } from '../components/ui';
import { colors, spacing } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>L&H Poultry</Text>
          <Text style={styles.subtitle}>Point of Sale</Text>

          <ErrorText text={error} />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@business.com"
          />
          <Input
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button title="Log in" onPress={onSubmit} loading={loading} disabled={!email || !password} />
          <Button
            title="Create a new business account"
            onPress={() => navigation.navigate('RegisterBusiness')}
            variant="secondary"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 32, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
});
