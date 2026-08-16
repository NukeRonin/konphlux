import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";
import { ForgeButton } from "./ForgeButton";

export function Loading({ label = "Forging…" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="loading-state">
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={[styles.msg, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "scroll",
  title,
  subtitle,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="empty-state">
      <MaterialCommunityIcons name={icon} size={54} color={colors.borderStrong} />
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? <Text style={[styles.msg, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="error-state">
      <MaterialCommunityIcons name="pipe-disconnected" size={54} color={colors.error} />
      <Text style={[styles.title, { color: colors.onSurface }]}>The boiler's gone cold.</Text>
      <Text style={[styles.msg, { color: colors.muted }]}>We couldn't fetch that just now.</Text>
      <ForgeButton label="Reignite the boiler" onPress={onRetry} testID="retry-button" style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
    minHeight: 320,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 18, marginTop: spacing.sm, textAlign: "center" },
  msg: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
});
