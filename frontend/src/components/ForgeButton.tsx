import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Variant = "forge" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const HEIGHTS: Record<Size, number> = { sm: 40, md: 48, lg: 54 };
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

/** The website's brass "forge" button — a gradient brass plate. */
export function ForgeButton({
  label,
  onPress,
  variant = "forge",
  size = "md",
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  testID,
}: Props) {
  const { colors } = useTheme();
  const height = HEIGHTS[size];

  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === "forge" ? colors.onBrandPrimary : colors.brand} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              {
                fontSize: FONT[size],
                color:
                  variant === "forge"
                    ? colors.onBrandPrimary
                    : variant === "outline"
                      ? colors.brand
                      : colors.onSurface,
              } as TextStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  const base: ViewStyle = {
    height,
    borderRadius: radius.md,
    opacity: disabled ? 0.5 : 1,
    alignSelf: fullWidth ? "stretch" : "flex-start",
    minWidth: fullWidth ? undefined : 120,
  };

  if (variant === "forge") {
    return (
      <Pressable testID={testID} onPress={handle} disabled={disabled || loading} style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
        <LinearGradient
          colors={colors.brassGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.plate, { height, borderColor: colors.brandSecondary }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        base,
        styles.plate,
        {
          backgroundColor: variant === "outline" ? "transparent" : colors.surfaceTertiary,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.borderStrong,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
});
