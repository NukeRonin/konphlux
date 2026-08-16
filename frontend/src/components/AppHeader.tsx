import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Small brass wordmark used in the app header. */
function Wordmark({ text, size = 22 }: { text: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <MaskedView
      maskElement={<Text style={[styles.brand, { fontSize: size }]}>{text}</Text>}
    >
      <LinearGradient colors={colors.brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[styles.brand, { fontSize: size, opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** Sticky, SafeArea-aware header with brass wordmark + action icons. */
export function AppHeader({
  title,
  subtitle,
  actions,
  onBack,
}: {
  title: string;
  subtitle?: string;
  actions?: { icon: IconName; onPress: () => void; testID?: string; badge?: boolean }[];
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} testID="header-back" style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Wordmark text={title} />
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          {actions?.map((a, i) => (
            <Pressable
              key={i}
              onPress={a.onPress}
              hitSlop={10}
              testID={a.testID}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name={a.icon} size={20} color={colors.brand} />
              {a.badge ? <View style={[styles.dot, { backgroundColor: colors.brandSecondary, borderColor: colors.surface }]} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { marginLeft: -6, marginRight: 2 },
  brand: { fontFamily: fonts.display, letterSpacing: 0.5, backgroundColor: "transparent" },
  subtitle: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
