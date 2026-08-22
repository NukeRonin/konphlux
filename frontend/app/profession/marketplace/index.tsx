import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Freelancer, Job } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { salaryText, timeAgo } from "@/src/utils/jobs";

type Tab = "gigs" | "freelancers" | "resume";

export default function Marketplace() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>(params.tab === "freelancers" ? "freelancers" : params.tab === "resume" ? "resume" : "gigs");
  const [q, setQ] = useState("");
  const [gigs, setGigs] = useState<Job[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [me, setMe] = useState<Freelancer | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTab = useCallback(async (t: Tab, query = "") => {
    setLoading(true);
    try {
      if (t === "gigs") setGigs(await api.jobGigs(query));
      else if (t === "freelancers") setFreelancers(await api.freelancers(query));
      else {
        const p = await api.freelancerMe();
        setMe(p && (p as Freelancer).id ? (p as Freelancer) : null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadTab(tab, q); }, [loadTab, tab, q]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="mkt-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Freelance Marketplace</Text>
          <Eyebrow>Profession Plaza</Eyebrow>
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([["gigs", "Find Gigs"], ["freelancers", "Freelancers"], ["resume", "My Résumé"]] as [Tab, string][]).map(([key, label]) => (
          <Pressable key={key} testID={`mkt-tab-${key}`} onPress={() => setTab(key)} style={styles.tab}>
            <Text style={[styles.tabText, { color: tab === key ? colors.brand : colors.muted }]}>{label}</Text>
            {tab === key ? <View style={[styles.tabBar, { backgroundColor: colors.brand }]} /> : null}
          </Pressable>
        ))}
      </View>

      {tab !== "resume" ? (
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={tab === "gigs" ? "Search gigs" : "Search freelancers, skills"} placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} testID="mkt-search" />
          </View>
        </View>
      ) : null}

      {loading ? (
        <Loading label="Loading…" />
      ) : tab === "gigs" ? (
        gigs.length === 0 ? (
          <Empty icon="briefcase-search" text="No gigs right now. Freelance, contract & internship listings show up here." />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {gigs.map((g) => {
              const sal = salaryText(g.salary_min, g.salary_max);
              return (
                <Pressable key={g.id} testID={`gig-${g.id}`} onPress={() => router.push(`/profession/${g.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={[styles.iconBox, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>{g.title}</Text>
                    <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{[g.company, g.job_type].filter(Boolean).join(" · ")}</Text>
                    {sal ? <Text style={[styles.cardMeta, { color: colors.onSurface }]}>{sal}</Text> : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : tab === "freelancers" ? (
        freelancers.length === 0 ? (
          <Empty icon="account-search" text="No freelancer profiles yet. Create yours under My Résumé to appear here." />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {freelancers.map((f) => (
              <Pressable key={f.id} testID={`freelancer-${f.id}`} onPress={() => router.push(`/profession/marketplace/freelancer/${f.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {f.avatar_url ? (
                  <Image source={{ uri: f.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="account" size={24} color={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>{f.name}</Text>
                    {f.featured ? (
                      <View style={[styles.featBadge, { backgroundColor: colors.brand }]}>
                        <MaterialCommunityIcons name="star" size={10} color={colors.onBrandPrimary} />
                        <Text style={[styles.featText, { color: colors.onBrandPrimary }]}>Featured</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{f.headline || f.category}</Text>
                  <View style={styles.rowGap}>
                    {f.hourly_rate ? <Text style={[styles.cardMeta, { color: colors.brand }]}>${f.hourly_rate}/hr</Text> : null}
                    {(f.review_count || 0) > 0 ? <Text style={[styles.cardMeta, { color: colors.onSurface }]}>★ {f.avg_rating}</Text> : null}
                    {(f.skills || []).slice(0, 2).map((s) => (
                      <View key={s} style={[styles.miniBadge, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text style={[styles.miniBadgeText, { color: colors.brand }]}>{s}</Text>
                      </View>
                    ))}
                    {f.available ? <Text style={[styles.cardMeta, { color: "#2F855A" }]}>● Available</Text> : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
          {me ? (
            <View style={[styles.meCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.meTop}>
                {me.avatar_url ? (
                  <Image source={{ uri: me.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="account" size={24} color={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{me.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.muted }]}>{me.headline || me.category}</Text>
                </View>
              </View>
              {me.bio ? <Text style={[styles.bio, { color: colors.onSurface }]}>{me.bio}</Text> : null}
              <Text style={[styles.updated, { color: colors.muted }]}>Updated {timeAgo(me.updated_at)}</Text>
              <ForgeButton label="Edit my résumé" fullWidth onPress={() => router.push("/profession/marketplace/edit")} testID="mkt-edit" style={{ marginTop: spacing.md }} />
              <Pressable testID="mkt-view-public" onPress={() => router.push(`/profession/marketplace/freelancer/${me.id}`)} style={styles.viewPublic}>
                <Text style={[styles.viewPublicText, { color: colors.brand }]}>View public profile & download PDF</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.meCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="file-account-outline" size={36} color={colors.brand} style={{ alignSelf: "center" }} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Create your résumé</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Build a freelancer profile so businesses can find and hire you. You can download it as a PDF anytime.</Text>
              <ForgeButton label="Build my résumé" fullWidth onPress={() => router.push("/profession/marketplace/edit")} testID="mkt-create" style={{ marginTop: spacing.md }} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Empty({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <MaterialCommunityIcons name={icon} size={40} color={colors.muted} />
      <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 19 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  tabBar: { height: 2, width: "60%", borderRadius: 2, marginTop: 6 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15.5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  featText: { fontFamily: fonts.bodyBold, fontSize: 9.5 },
  cardSub: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  cardMeta: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6, flexWrap: "wrap" },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  miniBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  meCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  meTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bio: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  updated: { fontFamily: fonts.bodyMedium, fontSize: 11.5, marginTop: spacing.sm },
  viewPublic: { alignItems: "center", paddingVertical: spacing.md },
  viewPublicText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 18, textAlign: "center", marginTop: spacing.sm },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: spacing.xs },
});
