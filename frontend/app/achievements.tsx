import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Profile } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Badge = { icon: IconName; title: string; desc: string; earned: boolean };

function buildBadges(p: Profile): Badge[] {
  return [
    { icon: "account-plus", title: "Welcome Aboard", desc: "Joined Konphlux", earned: true },
    { icon: "pencil", title: "First Words", desc: "Publish your first post", earned: p.stats.posts >= 1 },
    { icon: "feather", title: "Prolific Scribe", desc: "Publish 10 posts", earned: p.stats.posts >= 10 },
    { icon: "account-group", title: "Gathering a Crowd", desc: "Reach 50 followers", earned: p.stats.followers >= 50 },
    { icon: "star-circle", title: "Local Legend", desc: "Reach 500 followers", earned: p.stats.followers >= 500 },
    { icon: "bookmark-multiple", title: "Curator", desc: "Save 10 items", earned: p.stats.saved >= 10 },
    { icon: "bank", title: "Treasury Started", desc: "Hold a balance", earned: p.balance_cents > 0 },
    { icon: "shield-star", title: p.title, desc: "Your current standing", earned: true },
  ];
}

export default function Achievements() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setProfile(await api.getProfile());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const badges = profile ? buildBadges(profile) : [];
  const earned = badges.filter((b) => b.earned).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="achievements-back" style={styles.backHit}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Achievements</Text>
          <Eyebrow>{profile ? `${earned} of ${badges.length} earned` : "Your trophies"}</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Polishing your trophies…" />
      ) : status === "error" || !profile ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {badges.map((b, i) => (
              <Panel key={i} style={[styles.badge, { opacity: b.earned ? 1 : 0.5 }]}>
                <View style={[styles.badgeIcon, { backgroundColor: b.earned ? colors.brand : colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={b.earned ? b.icon : "lock"} size={24} color={b.earned ? colors.onBrandPrimary : colors.muted} />
                </View>
                <Text numberOfLines={1} style={[styles.badgeTitle, { color: colors.onSurface }]}>{b.title}</Text>
                <Text style={[styles.badgeDesc, { color: colors.muted }]}>{b.desc}</Text>
              </Panel>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  backHit: { padding: 4 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  badge: { width: "47%", alignItems: "center", gap: 6, paddingVertical: spacing.lg },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeTitle: { fontFamily: fonts.displaySemi, fontSize: 14, marginTop: 4 },
  badgeDesc: { fontFamily: fonts.body, fontSize: 11.5, textAlign: "center", lineHeight: 16 },
});
