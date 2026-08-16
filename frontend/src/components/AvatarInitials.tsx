import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/tokens";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Brass-plate avatar showing initials — matches the website's Avatar fallback. */
export function AvatarInitials({
  name,
  size = 44,
  style,
}: {
  name: string;
  size?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.brassGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.brandSecondary },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.34, color: colors.onBrandPrimary }]}>
        {initials(name)}
      </Text>
    </LinearGradient>
  );
}

/** Empty circular avatar for "add story" / placeholders. */
export function RingAvatar({
  size = 64,
  active = true,
  children,
}: {
  size?: number;
  active?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const inner = size - 6;
  return (
    <LinearGradient
      colors={active ? colors.brassGradient : [colors.border, colors.border, colors.border]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.surfaceSecondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  text: { fontFamily: fonts.displaySemi },
});
