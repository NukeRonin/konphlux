import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnboarding } from "@/src/onboarding/OnboardingContext";
import { fonts, spacing } from "@/src/theme/tokens";

const NAVY = "#121A26";
const NAVY_2 = "#1B2636";
const GOLD = "#C9A24B";
const CREAM = "#E8E0D0";
const MUTED = "#8A8375";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Slide = { icon: IconName; title: string; body: string };

const SLIDES: Slide[] = [
  {
    icon: "cog",
    title: "Welcome to Konphlux",
    body: "An entire steampunk world in one app. Twenty quarters, one ID — everything you need lives under a single account.",
  },
  {
    icon: "account-group",
    title: "Connect & Create",
    body: "Make friends, message and call, publish articles and go live. Craft art, videos and stories with built-in AI studios.",
  },
  {
    icon: "school",
    title: "Learn, Shop & Build",
    body: "Take courses, buy and sell in the Bazaar, find work, book stays, and manage your wallet — all in one place.",
  },
  {
    icon: "compass-rose",
    title: "Step Into the Machine",
    body: "Explore the districts at your own pace. Your Konphlux journey starts now.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (last) return finish();
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  const finish = async () => {
    await complete();
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Image source={require("../assets/images/logo-mark.png")} style={styles.mark} resizeMode="contain" />
        {!last ? (
          <Pressable onPress={finish} hitSlop={12} testID="onboarding-skip">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View style={styles.iconRing}>
              <MaterialCommunityIcons name={s.icon} size={78} color={GOLD} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, { width: i === index ? 22 : 8, backgroundColor: i === index ? GOLD : "#3A4353" }]} />
          ))}
        </View>
        <Pressable onPress={next} style={styles.cta} testID="onboarding-next">
          <Text style={styles.ctaText}>{last ? "Get Started" : "Next"}</Text>
          <MaterialCommunityIcons name={last ? "arrow-right-circle" : "chevron-right"} size={20} color={NAVY} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  mark: { width: 40, height: 40, borderRadius: 10 },
  skip: { fontFamily: fonts.bodyMedium, fontSize: 14, color: MUTED },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.lg },
  iconRing: { width: 168, height: 168, borderRadius: 84, alignItems: "center", justifyContent: "center", backgroundColor: NAVY_2, borderWidth: 2, borderColor: "#2E3849", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 27, color: CREAM, textAlign: "center" },
  body: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: MUTED, textAlign: "center", maxWidth: 340 },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  dot: { height: 8, borderRadius: 4 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 54, borderRadius: 14, backgroundColor: GOLD },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: NAVY, letterSpacing: 0.3 },
});
