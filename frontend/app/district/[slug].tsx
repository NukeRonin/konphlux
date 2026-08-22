import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, District } from "@/src/api/client";
import { BrassText, Eyebrow } from "@/src/components/BrassText";
import { ChatmongerCard } from "@/src/components/ChatmongerCard";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Gear } from "@/src/components/Gear";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Districts that have a dedicated functional hub (not just the Chatmonger chat).
const DISTRICT_HUBS: Record<string, { route: string; label: string }> = {
  roundtable: { route: "/roundtable", label: "Enter the Roundtable" },
  answerfier: { route: "/answerfier", label: "Enter Answerfier" },
  bazaar: { route: "/(tabs)/bazaar", label: "Enter the Bazaar" },
  "sparking-dawn": { route: "/sparking-dawn", label: "Enter Sparking Dawn" },
  "author-anvil": { route: "/anvil", label: "Enter Author Anvil" },
  brainboost: { route: "/brainboost", label: "Enter BrainBoost" },
  "pictureshow-theatre": { route: "/pictureshow", label: "Enter PictureShow" },
  chatterbox: { route: "/chatterbox", label: "Enter Chatterbox" },
};

// Author Anvil — every feature opens a real writing/publishing destination.
const ANVIL_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Stories": { route: "/anvil?kind=story", icon: "book-open-variant" },
  "Scripts": { route: "/anvil?kind=script", icon: "script-text" },
  "Prompts": { route: "/anvil/prompts", icon: "lightbulb-on" },
  "Write & Submit Stories": { route: "/anvil/write?kind=story", icon: "feather" },
  "Write & Submit Scripts": { route: "/anvil/write?kind=script", icon: "script-text-play" },
  "Story Categories": { route: "/anvil", icon: "shape-outline" },
  "GenoScribe": { route: "/anvil/genoscribe", icon: "auto-fix" },
  "Co-writing": { route: "/anvil/cowriting", icon: "account-multiple" },
  "AIventure": { route: "/anvil/aiventure", icon: "compass-rose" },
};

// Sparking Dawn — the two feature buttons open the discovery deck filtered by who you seek.
const SPARKING_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "I'm looking for men": { route: "/sparking-dawn?seeking=man", icon: "gender-male" },
  "I'm looking for women": { route: "/sparking-dawn?seeking=woman", icon: "gender-female" },
};

// For the Bazaar district, every feature chip opens a working destination.
const BAZAAR_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Buy": { route: "/(tabs)/bazaar", icon: "cart" },
  "Sell": { route: "/bazaar/sell", icon: "tag-plus" },
  "Booths": { route: "/bazaar/booths", icon: "storefront" },
  "Setup Booth": { route: "/bazaar/new-booth", icon: "store-plus" },
  "You Might Be Interested In": { route: "/(tabs)/bazaar", icon: "lightbulb-on" },
  "Your Posts": { route: "/bazaar/mine", icon: "package-variant" },
  "Your Saves": { route: "/saved", icon: "bookmark-multiple" },
  "Seller ratings": { route: "/bazaar/mine", icon: "star-circle" },
  "eBooks": { route: "/(tabs)/bazaar?category=eBooks", icon: "book-open-page-variant" },
  "Audio Books": { route: "/(tabs)/bazaar?category=Audio Books", icon: "headphones" },
  "Wish lists": { route: "/saved", icon: "heart" },
  "Shopping cart": { route: "/cart", icon: "cart-outline" },
  "Checkout": { route: "/cart", icon: "credit-card-outline" },
};

// For the Answerfier district, each feature chip opens the Q&A board with a filter.
const ANSWERFIER_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "New Questions": { route: "/answerfier?filter=new", icon: "clock-outline" },
  "Popular Questions": { route: "/answerfier?filter=popular", icon: "fire" },
  "Trending Questions": { route: "/answerfier?filter=trending", icon: "trending-up" },
  "Unanswered Questions": { route: "/answerfier?filter=unanswered", icon: "help-circle-outline" },
  "Categories": { route: "/answerfier", icon: "shape-outline" },
};

// BrainBoost — every feature opens a real learning destination.
const BRAINBOOST_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Courses": { route: "/brainboost/courses", icon: "book-education" },
  "Fun Facts": { route: "/brainboost/facts", icon: "lightbulb-on" },
  "Dictionary": { route: "/brainboost/lexicon?mode=dictionary", icon: "book-alphabet" },
  "Thesaurus": { route: "/brainboost/lexicon?mode=thesaurus", icon: "book-search" },
  "Quizzes": { route: "/brainboost/quizzes", icon: "help-circle" },
  "Video lessons": { route: "/brainboost/videos", icon: "play-circle" },
  "Saved progress": { route: "/brainboost/courses", icon: "progress-check" },
  "AI tutoring": { route: "/chatmonger/brainboost", icon: "school" },
  "Repair Guy": { route: "/brainboost/repair", icon: "wrench" },
};

// For the Roundtable district, each feature chip is a working shortcut.
const ROUNDTABLE_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Create Community": { route: "/roundtable/new-community", icon: "account-multiple-plus" },
  "Browse Communities": { route: "/roundtable/communities?filter=all", icon: "account-group" },
  "Recently Visited": { route: "/roundtable/communities?filter=recent", icon: "history" },
  "Joined Communities": { route: "/roundtable/communities?filter=joined", icon: "account-check" },
  "Discussion threads": { route: "/roundtable", icon: "forum" },
  "Discussions I Started": { route: "/roundtable/my-threads", icon: "feather" },
  "Site-wide discussion routing": { route: "/roundtable", icon: "sitemap" },
};

// PictureShow — every feature opens a real destination. Streamora is a branch.
const PICTURESHOW_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Videos": { route: "/pictureshow/videos", icon: "movie-open" },
  "Upload videos": { route: "/pictureshow/upload", icon: "upload" },
  "Categories": { route: "/pictureshow/videos", icon: "shape-outline" },
  "Streamora": { route: "/pictureshow/streamora", icon: "video-wireless" },
  "Subscriptions": { route: "/pictureshow/subscriptions", icon: "bell-ring" },
  "Playlists": { route: "/pictureshow/playlists", icon: "playlist-play" },
  "Channels": { route: "/pictureshow/channels", icon: "account-group" },
  "Trending": { route: "/pictureshow/videos", icon: "fire" },
  "Create AI Video": { route: "/pictureshow/ai?kind=video", icon: "movie-filter" },
  "Create AI Animation": { route: "/pictureshow/ai?kind=animation", icon: "animation-play" },
};

// Chatterbox — messaging district.
const CHATTERBOX_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Private messaging": { route: "/chatterbox/inbox", icon: "message-text" },
  "Group chats": { route: "/chatterbox/inbox?filter=group", icon: "account-multiple" },
  "Voice calls": { route: "/chatterbox/new?call=voice", icon: "phone" },
  "Video calls": { route: "/chatterbox/new?call=video", icon: "video" },
};

// Bluepaint — Space Designer replaces Floor Plan Studio + Room Planner.
const BLUEPAINT_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Space Designer": { route: "/bluepaint", icon: "floor-plan" },
  "Materials Estimator": { route: "/bluepaint/estimator", icon: "cube-scan" },
  "Construction Cost Estimator": { route: "/chatmonger/bluepaint", icon: "calculator-variant" },
  "Design Reviews with Iris": { route: "/chatmonger/bluepaint", icon: "eye-check" },
  "Saved Blueprints": { route: "/bluepaint", icon: "folder-multiple-image" },
};

const ACTIONS_BY_SLUG: Record<string, Record<string, { route: string; icon: IconName }>> = {
  roundtable: ROUNDTABLE_ACTIONS,
  answerfier: ANSWERFIER_ACTIONS,
  bazaar: BAZAAR_ACTIONS,
  "sparking-dawn": SPARKING_ACTIONS,
  "author-anvil": ANVIL_ACTIONS,
  brainboost: BRAINBOOST_ACTIONS,
  "pictureshow-theatre": PICTURESHOW_ACTIONS,
  chatterbox: CHATTERBOX_ACTIONS,
  bluepaint: BLUEPAINT_ACTIONS,
};

export default function DistrictDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [district, setDistrict] = useState<District | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setStatus("loading");
      const res = await api.getDistrict(slug);
      setDistrict(res);
      setSaved(!!res.saved);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavourite = async () => {
    setSaved((s) => !s);
    try {
      await api.toggleSave("district", slug!);
    } catch {
      setSaved((s) => !s);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {status === "loading" ? (
        <>
          <View style={{ height: insets.top }} />
          <Loading label="Entering the district…" />
        </>
      ) : status === "error" || !district ? (
        <>
          <View style={{ height: insets.top }} />
          <ErrorState onRetry={load} />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient
            colors={[colors.surfaceTertiary, colors.surface]}
            style={[styles.hero, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.border }]}
          >
            <Gear size={220} opacity={0.09} style={{ right: -60, top: -40 }} />
            <Gear size={120} opacity={0.08} reverse style={{ left: -30, top: 120 }} />
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => router.back()} hitSlop={12} testID="district-back" style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
              </Pressable>
              <Pressable onPress={toggleFavourite} hitSlop={12} testID="district-favourite" style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: saved ? colors.brand : colors.border }]}>
                <MaterialCommunityIcons name={saved ? "star" : "star-outline"} size={22} color={saved ? colors.brandPrimary : colors.onSurface} />
              </Pressable>
            </View>

            <View style={[styles.heroIcon, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
              <MaterialCommunityIcons name={district.icon as IconName} size={30} color={colors.brand} />
            </View>
            <Eyebrow style={{ marginTop: spacing.lg }}>District</Eyebrow>
            <BrassText size={38} style={{ marginTop: 6 }}>{district.name}</BrassText>
            <Text style={[styles.tagline, { color: colors.brand }]}>{district.tagline}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{district.description}</Text>
            <ForgeButton
              label={DISTRICT_HUBS[district.slug]?.label ?? `Enter & chat with ${district.chatmonger.name}`}
              style={{ marginTop: spacing.lg }}
              testID="district-enter"
              icon={<MaterialCommunityIcons name="arrow-right-bold-box" size={18} color={colors.onBrandPrimary} />}
              onPress={() =>
                DISTRICT_HUBS[district.slug]
                  ? router.push(DISTRICT_HUBS[district.slug].route as any)
                  : router.push(`/chatmonger/${district.slug}`)
              }
            />
          </LinearGradient>

          {/* Features */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Inside {district.name}</Text>
            {ACTIONS_BY_SLUG[district.slug] ? (
              <View style={{ gap: spacing.sm }}>
                {district.features.map((f) => {
                  const action = ACTIONS_BY_SLUG[district.slug][f];
                  if (!action) return null;
                  return (
                    <Pressable
                      key={f}
                      testID={`feature-${f}`}
                      onPress={() => router.push(action.route as any)}
                      style={({ pressed }) => [
                        styles.featureRow,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <View style={[styles.featureRowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                        <MaterialCommunityIcons name={action.icon} size={18} color={colors.brand} />
                      </View>
                      <Text style={[styles.featureRowText, { color: colors.onSurface }]}>{f}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.featureGrid}>
                {district.features.map((f) => (
                  <View
                    key={f}
                    style={[styles.feature, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  >
                    <MaterialCommunityIcons name="cog" size={13} color={colors.brandPrimary} />
                    <Text style={[styles.featureText, { color: colors.onSurface }]}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Chatmonger */}
          <View style={styles.section}>
            <ChatmongerCard
              chatmonger={district.chatmonger}
              district={district.name}
              onPress={() => router.push(`/chatmonger/${district.slug}`)}
            />
          </View>

          {/* Nearby districts */}
          {district.nearby && district.nearby.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Nearby districts</Text>
              <View style={{ gap: spacing.sm }}>
                {district.nearby.map((d) => (
                  <Pressable
                    key={d.slug}
                    testID={`nearby-${d.slug}`}
                    onPress={() => router.push(`/district/${d.slug}`)}
                  >
                    <Panel style={styles.nearbyRow}>
                      <View style={[styles.nearbyIcon, { backgroundColor: colors.surfaceTertiary }]}>
                        <MaterialCommunityIcons name={d.icon as IconName} size={20} color={colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.nearbyName, { color: colors.onSurface }]}>{d.name}</Text>
                        <Text numberOfLines={1} style={[styles.nearbyTagline, { color: colors.muted }]}>
                          {d.tagline}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right" size={18} color={colors.brand} />
                    </Panel>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomWidth: 1, overflow: "hidden" },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.sm },

  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, marginBottom: spacing.md },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  featureRowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  featureRowText: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 15 },

  nearbyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nearbyIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  nearbyName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  nearbyTagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
