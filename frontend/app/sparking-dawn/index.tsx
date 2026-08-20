import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SparkCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const { width } = Dimensions.get("window");
const SWIPE = width * 0.9;

type Seeking = "man" | "woman" | "all";
const TABS: { key: Seeking; label: string }[] = [
  { key: "man", label: "Men" },
  { key: "woman", label: "Women" },
  { key: "all", label: "Everyone" },
];

function Card({ spark, colors, front }: { spark: SparkCard; colors: any; front?: boolean }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <Image source={{ uri: spark.photo }} style={styles.cardImage} contentFit="cover" transition={150} />
      <LinearGradient colors={["transparent", "rgba(20,16,10,0.85)"]} style={styles.cardScrim} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>
          {spark.display_name}
          {spark.age ? <Text style={styles.cardAge}>  {spark.age}</Text> : null}
        </Text>
        {spark.tagline ? <Text style={styles.cardTagline}>{spark.tagline}</Text> : null}
        {front && spark.bio ? <Text numberOfLines={2} style={styles.cardBio}>{spark.bio}</Text> : null}
      </View>
    </View>
  );
}

export default function SparkingDawn() {
  const { seeking: seekParam } = useLocalSearchParams<{ seeking?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [seeking, setSeeking] = useState<Seeking>(
    seekParam === "man" || seekParam === "woman" ? seekParam : "all",
  );
  const [cards, setCards] = useState<SparkCard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [matched, setMatched] = useState<SparkCard | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setCards(await api.datingDiscover(seeking));
      tx.value = 0;
      ty.value = 0;
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [seeking, tx, ty]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = useCallback(
    async (action: "like" | "pass", card: SparkCard) => {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      tx.value = 0;
      ty.value = 0;
      try {
        const res = await api.datingSwipe(card.id, action);
        if (res.match && res.profile) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMatched(res.profile);
        }
      } catch {
        /* silent */
      }
    },
    [tx, ty],
  );

  const fling = useCallback(
    (action: "like" | "pass") => {
      const top = cards[0];
      if (!top) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      tx.value = withTiming(action === "like" ? SWIPE : -SWIPE, { duration: 220 }, (done) => {
        if (done) runOnJS(commit)(action, top);
      });
    },
    [cards, commit, tx],
  );

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 120) {
        const action = e.translationX > 0 ? "like" : "pass";
        const top = cards[0];
        tx.value = withTiming(action === "like" ? SWIPE : -SWIPE, { duration: 200 }, (done) => {
          if (done && top) runOnJS(commit)(action, top);
        });
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-SWIPE, SWIPE], [-12, 12])}deg` },
    ],
  }));
  const likeBadge = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [20, 120], [0, 1], "clamp") }));
  const passBadge = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-120, -20], [1, 0], "clamp") }));

  const top = cards[0];
  const next = cards[1];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="sparking-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Sparking Dawn</Text>
          <Eyebrow>Strike a spark</Eyebrow>
        </View>
        <Pressable testID="edit-dating-profile" onPress={() => router.push("/sparking-dawn/profile")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="account-cog" size={19} color={colors.brand} />
        </Pressable>
        <Pressable testID="view-matches" onPress={() => router.push("/sparking-dawn/matches")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="heart-multiple" size={19} color={colors.brandSecondary} />
        </Pressable>
      </View>

      {/* Seeking toggle */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            testID={`seeking-${t.key}`}
            onPress={() => setSeeking(t.key)}
            style={[styles.tab, { backgroundColor: seeking === t.key ? colors.brand : colors.surfaceSecondary, borderColor: seeking === t.key ? colors.brand : colors.border }]}
          >
            <Text style={[styles.tabText, { color: seeking === t.key ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {status === "loading" ? (
        <Loading label="Finding kindred sparks…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : !top ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState icon="heart-off-outline" title="No more sparks right now" subtitle="Check back soon, or widen who you're looking for." />
          <ForgeButton label="Refresh" variant="outline" onPress={load} testID="spark-refresh" style={{ alignSelf: "center", marginTop: spacing.lg }} />
        </View>
      ) : (
        <View style={styles.deck}>
          {next ? (
            <View style={[styles.stackBehind, { pointerEvents: "none" }]}>
              <Card spark={next} colors={colors} />
            </View>
          ) : null}
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.stackFront, topStyle]}>
              <Card spark={top} colors={colors} front />
              <Animated.View style={[styles.stampLike, likeBadge]}>
                <Text style={styles.stampLikeText}>SPARK</Text>
              </Animated.View>
              <Animated.View style={[styles.stampPass, passBadge]}>
                <Text style={styles.stampPassText}>PASS</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      {top && status === "ready" ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable testID="btn-pass" onPress={() => fling("pass")} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="close" size={30} color={colors.muted} />
          </Pressable>
          <Pressable testID="btn-like" onPress={() => fling("like")} style={[styles.actionBtn, styles.likeBtn, { borderColor: colors.brandSecondary }]}>
            <LinearGradient colors={colors.brassGradient} style={styles.likeGrad}>
              <MaterialCommunityIcons name="heart" size={30} color={colors.onBrandPrimary} />
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      {/* Match celebration */}
      {matched ? (
        <View style={styles.matchOverlay} testID="match-overlay">
          <View style={[styles.matchCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brandSecondary }]}>
            <Text style={[styles.matchTitle, { color: colors.brandSecondary }]}>It's a Spark!</Text>
            <Image source={{ uri: matched.photo }} style={styles.matchPhoto} contentFit="cover" />
            <Text style={[styles.matchName, { color: colors.onSurface }]}>You and {matched.display_name} liked each other</Text>
            <ForgeButton label="View matches" fullWidth onPress={() => { setMatched(null); router.push("/sparking-dawn/matches"); }} testID="match-view" style={{ marginTop: spacing.lg }} />
            <ForgeButton label="Keep swiping" variant="ghost" fullWidth onPress={() => setMatched(null)} testID="match-continue" style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const CARD_H = 460;
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tab: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  deck: { flex: 1, alignItems: "center", justifyContent: "center" },
  stackBehind: { position: "absolute", top: 0, transform: [{ scale: 0.94 }], opacity: 0.7 },
  stackFront: { position: "absolute", top: 0 },
  card: {
    width: width - spacing.xl * 2,
    height: CARD_H,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardImage: { width: "100%", height: "100%" },
  cardScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  cardInfo: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cardName: { fontFamily: fonts.display, fontSize: 26, color: "#F6F1E7" },
  cardAge: { fontFamily: fonts.displayReg, fontSize: 22, color: "#F6F1E7" },
  cardTagline: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#E7CD94", marginTop: 4 },
  cardBio: { fontFamily: fonts.body, fontSize: 14, color: "#E8E0D2", marginTop: 6 },
  stampLike: { position: "absolute", top: 28, left: 24, borderWidth: 4, borderColor: "#4A7C59", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: "-16deg" }] },
  stampLikeText: { fontFamily: fonts.display, fontSize: 26, color: "#4A7C59" },
  stampPass: { position: "absolute", top: 28, right: 24, borderWidth: 4, borderColor: "#8B3A3A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: "16deg" }] },
  stampPassText: { fontFamily: fonts.display, fontSize: 26, color: "#8B3A3A" },
  actions: { flexDirection: "row", justifyContent: "center", gap: spacing.xxl, paddingTop: spacing.md },
  actionBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  likeBtn: { borderWidth: 2, overflow: "hidden" },
  likeGrad: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  matchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,16,10,0.8)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  matchCard: { width: "100%", borderRadius: radius.lg, borderWidth: 2, padding: spacing.xl, alignItems: "center" },
  matchTitle: { fontFamily: fonts.display, fontSize: 30, marginBottom: spacing.lg },
  matchPhoto: { width: 140, height: 140, borderRadius: 70, marginBottom: spacing.lg },
  matchName: { fontFamily: fonts.bodyMedium, fontSize: 15, textAlign: "center" },
});
