import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnboarding } from "@/src/onboarding/OnboardingContext";
import { useAuth } from "@/src/auth/AuthContext";
import { fonts, spacing } from "@/src/theme/tokens";

const NAVY = "#121A26";
const NAVY_2 = "#1B2636";
const GOLD = "#C9A24B";
const CREAM = "#E8E0D0";
const MUTED = "#8A8375";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Slide = { icon: IconName; title: string; body: string; shot?: ImageSourcePropType };

const SLIDES: Slide[] = [
  {
    icon: "compass-outline",
    title: "Twenty Districts, One ID",
    body: "An entire steampunk world in one app. Explore twenty quarters — everything lives under a single account.",
    shot: require("../assets/images/onb-districts.png"),
  },
  {
    icon: "account-group",
    title: "Connect & Create",
    body: "Follow friends, share to your feed, publish and go live. Craft art, videos and stories with built-in AI studios.",
    shot: require("../assets/images/onb-feed.png"),
  },
  {
    icon: "wallet-outline",
    title: "Learn, Shop & Build",
    body: "Take courses, buy and sell in the Bazaar, find work, and manage your own Konphlux wallet — all in one HQ.",
    shot: require("../assets/images/onb-hq.png"),
  },
  {
    icon: "cog",
    title: "Step Into the Machine",
    body: "Explore the districts at your own pace. Your Konphlux journey starts now.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const last = index === SLIDES.length - 1;
  const SLIDE_MS = 3800;

  // Gently auto-advance through the tour (with a filling progress bar) until the
  // last slide, unless paused.
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (last) {
      progress.setValue(1);
      return;
    }
    if (paused) return;
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start();
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    }, SLIDE_MS);
    return () => { anim.stop(); clearTimeout(t); };
  }, [index, paused, last, width, progress]);

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
    // Replaying while signed in should drop the user back into the app, not the login gate.
    router.replace(user ? "/(tabs)" : "/(auth)/login");
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
            <Pressable onPress={() => !last && setPaused((p) => !p)} testID="onboarding-pause">
              {s.shot ? (
                <View style={styles.phoneFrame}>
                  <Image source={s.shot} style={styles.shot} resizeMode="cover" />
                  {paused && !last ? (
                    <View style={styles.pauseBadge}>
                      <MaterialCommunityIcons name="pause" size={16} color={NAVY} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.iconRing}>
                  <MaterialCommunityIcons name={s.icon} size={78} color={GOLD} />
                </View>
              )}
            </Pressable>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
            {!last ? (
              <Text style={styles.pauseHint}>{paused ? "Paused · tap to resume" : "Tap image to pause"}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={styles.pTrack}>
              <Animated.View
                style={[
                  styles.pFill,
                  {
                    width: i < index ? "100%" : i === index ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) : "0%",
                  },
                ]}
              />
            </View>
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
  phoneFrame: { width: 232, height: 454, borderRadius: 30, borderWidth: 5, borderColor: "#2E3849", backgroundColor: NAVY_2, overflow: "hidden", marginBottom: spacing.sm, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  shot: { width: "100%", height: "100%" },
  pauseBadge: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  pauseHint: { fontFamily: fonts.body, fontSize: 12, color: "#5D6472", letterSpacing: 0.4 },
  iconRing: { width: 168, height: 168, borderRadius: 84, alignItems: "center", justifyContent: "center", backgroundColor: NAVY_2, borderWidth: 2, borderColor: "#2E3849", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 27, color: CREAM, textAlign: "center" },
  body: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: MUTED, textAlign: "center", maxWidth: 340 },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  pTrack: { flex: 1, maxWidth: 64, height: 4, borderRadius: 2, backgroundColor: "#3A4353", overflow: "hidden" },
  pFill: { height: "100%", borderRadius: 2, backgroundColor: GOLD },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 54, borderRadius: 14, backgroundColor: GOLD },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: NAVY, letterSpacing: 0.3 },
});
