import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const COLORS = ["#C0392B", "#E67E22", "#F1C40F", "#27AE60", "#2980B9", "#8E44AD"];
const { width: SCREEN_W } = Dimensions.get("window");

function Piece({ index, onDone }: { index: number; onDone?: () => void }) {
  const fall = useRef(new Animated.Value(0)).current;
  const startX = (index / 24) * SCREEN_W + (Math.random() - 0.5) * 40;
  const drift = (Math.random() - 0.5) * 120;
  const size = 7 + Math.random() * 7;
  const color = COLORS[index % COLORS.length];
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`] });
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-30, 480 + Math.random() * 120] });
  const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const opacity = fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });

  useEffect(() => {
    Animated.timing(fall, {
      toValue: 1,
      duration: 1800 + Math.random() * 900,
      delay: Math.random() * 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => { if (index === 0) onDone?.(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: 0,
        width: size,
        height: size * 1.6,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

/** One-shot confetti rain overlay. Mount when triggered; calls onDone when finished. */
export function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 24 }).map((_, i) => (
        <Piece key={i} index={i} onDone={onDone} />
      ))}
    </View>
  );
}
