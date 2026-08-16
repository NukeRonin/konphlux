import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { radius, spacing } from "@/src/theme/tokens";

type PanelProps = ViewProps & {
  glow?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

/** Signature Konphlux "panel" card: card bg, 1px border, xl radius, soft forge shadow. */
export function Panel({ children, glow, padded = true, style, ...rest }: PanelProps) {
  const { colors, mode } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: glow ? colors.aether : colors.border,
          padding: padded ? spacing.lg : 0,
          shadowColor: glow ? colors.aether : colors.shadow,
          shadowOpacity: glow ? 0.35 : mode === "dark" ? 0.4 : 0.14,
          shadowRadius: glow ? 18 : 12,
          elevation: glow ? 8 : 3,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
  },
});
