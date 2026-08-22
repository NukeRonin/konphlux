import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const { width, height } = Dimensions.get("window");
const EMOJIS = ["🎉", "🎊", "✨", "⭐", "🎈", "💛"];
const PIECES = 22;

function Piece({ index }: { index: number }) {
  const y = useRef(new Animated.Value(-40)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const startX = (index / PIECES) * width + (Math.random() * 40 - 20);
  const delay = Math.random() * 500;
  const duration = 2200 + Math.random() * 1200;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: height + 60, duration, delay, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.loop(Animated.timing(rot, { toValue: 1, duration: 900, useNativeDriver: true })),
    ]).start();
  }, [y, rot, duration, delay]);

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.Text style={[styles.piece, { left: startX, transform: [{ translateY: y }, { rotate }] }]}>
      {EMOJIS[index % EMOJIS.length]}
    </Animated.Text>
  );
}

export function ConfettiCelebration({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [scale, onDone]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {Array.from({ length: PIECES }).map((_, i) => <Piece key={i} index={i} />)}
      <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.brand, transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="party-popper" size={40} color={colors.brand} />
        <Text style={[styles.title, { color: colors.onSurface }]}>Funded!</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Your fundraiser reached its goal. Congratulations!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 50 },
  piece: { position: "absolute", top: 0, fontSize: 26 },
  card: { alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, borderWidth: 2, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, maxWidth: "80%" },
  title: { fontFamily: fonts.display, fontSize: 28 },
  sub: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
