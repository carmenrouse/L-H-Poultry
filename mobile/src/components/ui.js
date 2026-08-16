import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '../theme';

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, loading, variant = 'primary', style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export function Badge({ text, tone = 'default' }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`] || styles.badge_default]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`] || styles.badgeText_default]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ text }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

export function ErrorText({ text }) {
  if (!text) return null;
  return <Text style={styles.errorText}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonTextSecondary: { color: colors.primary },
  label: { color: colors.textMuted, marginBottom: spacing.xs, fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badge_default: { backgroundColor: '#e5e7eb' },
  badgeText_default: { color: '#374151' },
  badge_success: { backgroundColor: '#dcfce7' },
  badgeText_success: { color: colors.success },
  badge_warning: { backgroundColor: '#fef3c7' },
  badgeText_warning: { color: colors.warning },
  badge_danger: { backgroundColor: '#fee2e2' },
  badgeText_danger: { color: colors.danger },
  badge_info: { backgroundColor: '#dbeafe' },
  badgeText_info: { color: '#1d4ed8' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  emptyState: { padding: spacing.xl, alignItems: 'center' },
  emptyStateText: { color: colors.textMuted, fontSize: 15 },
  errorText: { color: colors.danger, marginBottom: spacing.sm },
});
