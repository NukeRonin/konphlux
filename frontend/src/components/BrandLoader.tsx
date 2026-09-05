import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/src/theme/tokens";

const NAVY = "#121A26";

/** Branded boot / loading screen — the Konphlux gear logo turning slowly. */
export default function BrandLoader({ label = "Loading…" }: { label?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rot = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    rot.start();
    glow.start();
    return () => {
      rot.stop();
      glow.stop();
    };
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Image source={require("../../assets/images/logo-mark.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.title}>KONPHLUX</Text>
      <Animated.Text style={[styles.sub, { opacity }]}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NAVY, gap: 18 },
  logo: { width: 132, height: 132, borderRadius: 24 },
  title: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 3, color: "#C9A24B" },
  sub: { fontFamily: fonts.body, fontSize: 13.5, letterSpacing: 1, color: "#8A8375" },
});
