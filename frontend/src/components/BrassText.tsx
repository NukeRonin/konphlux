import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TextStyle, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/tokens";

type BrassTextProps = {
  children: string;
  size?: number;
  style?: TextStyle;
  weight?: "bold" | "semi";
};

/** Large Cinzel heading with the website's "brass-text" gradient fill. */
export function BrassText({ children, size = 34, style, weight = "bold" }: BrassTextProps) {
  const { colors } = useTheme();
  const fontFamily = weight === "bold" ? fonts.display : fonts.displaySemi;
  const lineHeight = size * 1.12;

  return (
    <MaskedView
      maskElement={
        <Text style={[styles.text, { fontSize: size, lineHeight, fontFamily }, style]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors.brassGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Transparent copy sizes the gradient to the text */}
        <Text
          style={[styles.text, { fontSize: size, lineHeight, fontFamily, opacity: 0 }, style]}
        >
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  text: {
    letterSpacing: -0.3,
    backgroundColor: "transparent",
  },
});

export function Eyebrow({ children, style }: { children: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.bodyMedium,
          fontSize: 10.5,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: colors.muted,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** thin brass hairline divider */
export function Hairline({ style }: { style?: any }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: StyleSheet.hairlineWidth * 2 }}>
      <LinearGradient
        colors={["transparent", colors.borderStrong, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[{ flex: 1 }, style]}
      />
    </View>
  );
}
