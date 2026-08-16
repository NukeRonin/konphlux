import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/src/theme/ThemeContext";

/** Decorative slowly-spinning gear used behind hero sections. */
export function Gear({
  size = 220,
  reverse = false,
  duration = 24000,
  style,
  opacity = 0.1,
}: {
  size?: number;
  reverse?: boolean;
  duration?: number;
  style?: ViewStyle;
  opacity?: number;
}) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, reverse, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.wrap, { opacity }, animatedStyle, style]} pointerEvents="none">
      <MaterialCommunityIcons name="cog" size={size} color={colors.brand} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute" },
});
