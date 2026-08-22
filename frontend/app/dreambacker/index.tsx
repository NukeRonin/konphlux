import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, DBProject } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { DB_CATEGORIES, FUNDING_MODELS, categoryMeta, timeLeft } from "@/src/utils/dreambacker";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "popular", label: "Popular" },
  { key: "trending", label: "Trending" },
  { key: "deadline", label: "Near Deadline" },
  { key: "mine", label: "Mine" },
];

const FILTER_PROMPTS: Record<string, { icon: IconName; text: string }> = {
  all: { icon: "hand-heart", text: "Every dream currently seeking backers." },
  new: { icon: "new-box", text: "Freshly launched — be an early backer." },
  popular: { icon: "account-group", text: "The fundraisers with the most backers." },
  trending: { icon: "trending-up", text: "Gaining the most support right now." },
  deadline: { icon: "clock-alert-outline", text: "Ending within 48 hours — back them before time runs out." },
  mine: { icon: "account-star", text: "Fundraisers you've launched." },
};

function Countdown({ deadline, color, muted }: { deadline: string | null; color: string; muted: string }) {
  const c = timeLeft(deadline);
  if (!c) return null;
  const label = c.done ? "Ended" : c.days > 0 ? `${c.days}d ${c.hours}h left` : `${c.hours}h ${c.minutes}m left`;
  return (
    <View style={styles.metaChip}>
      <MaterialCommunityIcons name="clock-outline" size={13} color={c.done ? muted : color} />
      <Text style={[styles.metaChipText, { color: c.done ? muted : color }]}>{label}</Text>
    </View>
  );
}

export default function DreambackerHome() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<string>(params.filter && FILTERS.some((f) => f.key === params.filter) ? params.filter : "all");
  const [category, setCategory] = useState<string>("");
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [list, alerts] = await Promise.all([api.dbProjects(filter, category), api.dbAlerts().catch(() => ({ count: 0, project_ids: [] }))]);
      setProjects(list);
      setAlertIds(new Set(alerts.project_ids));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [filter, category]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (p: DBProject) => {
    Alert.alert("Delete fundraiser?", `"${p.title}" and its updates will be permanently removed. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.dbDeleteProject(p.id); load(); } catch { /* ignore */ } } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="db-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Dreambacker</Text>
          <Eyebrow>Fund the improbable</Eyebrow>
        </View>
        {alertIds.size > 0 ? (
          <View testID="db-alert-bell" style={styles.bellWrap}>
            <MaterialCommunityIcons name="bell-ring" size={22} color={colors.brand} />
            <View style={[styles.bellBadge, { backgroundColor: colors.error ?? colors.brand }]}>
              <Text style={styles.bellBadgeText}>{alertIds.size}</Text>
            </View>
          </View>
        ) : null}
        <Pressable testID="db-start" onPress={() => router.push("/dreambacker/new")} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <Pressable
                testID={`db-filter-${item.key}`}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}
              >
                <Text style={[styles.filterText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
        <FlatList
          horizontal
          data={[{ key: "", label: "All", icon: "shape-outline" }, ...DB_CATEGORIES]}
          keyExtractor={(c) => c.key || "all-cat"}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catFilterRow}
          renderItem={({ item }) => {
            const active = category === item.key;
            return (
              <Pressable
                testID={`db-cat-${item.key || "all"}`}
                onPress={() => setCategory(item.key)}
                style={[styles.catFilterChip, { backgroundColor: active ? colors.surfaceTertiary : "transparent", borderColor: active ? colors.brand : colors.border }]}
              >
                <MaterialCommunityIcons name={item.icon as IconName} size={13} color={active ? colors.brand : colors.muted} />
                <Text style={[styles.catFilterText, { color: active ? colors.brand : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.prompt, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={FILTER_PROMPTS[filter].icon} size={18} color={colors.brand} />
            <Text style={[styles.promptText, { color: colors.onSurface }]}>{FILTER_PROMPTS[filter].text}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fm = FUNDING_MODELS[item.funding_model];
          const cat = categoryMeta(item.category);
          const hasNew = alertIds.has(item.id);
          return (
            <Pressable testID={`db-project-${item.id}`} onPress={() => router.push(`/dreambacker/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: hasNew ? colors.brand : colors.border }]}>
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
              ) : null}
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.fmBadge, { backgroundColor: colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons name={fm.icon as IconName} size={12} color={colors.brand} />
                      <Text style={[styles.fmBadgeText, { color: colors.brand }]}>{fm.label}</Text>
                    </View>
                    <View style={[styles.fmBadge, { backgroundColor: colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons name={cat.icon as IconName} size={12} color={colors.muted} />
                      <Text style={[styles.fmBadgeText, { color: colors.muted }]}>{cat.label}</Text>
                    </View>
                  </View>
                  <Countdown deadline={item.deadline} color={colors.brand} muted={colors.muted} />
                </View>
                {hasNew ? (
                  <View style={[styles.newBadge, { backgroundColor: colors.brand }]}>
                    <MaterialCommunityIcons name="bell-ring" size={11} color={colors.onBrandPrimary} />
                    <Text style={[styles.newBadgeText, { color: colors.onBrandPrimary }]}>New update</Text>
                  </View>
                ) : null}
                <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
                <Text style={[styles.cardCreator, { color: colors.muted }]}>by {item.creator_name}</Text>

                <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                  <View style={[styles.fill, { backgroundColor: colors.brand, width: `${Math.round(item.progress * 100)}%` }]} />
                </View>
                <View style={styles.cardStatsRow}>
                  <Text style={[styles.raised, { color: colors.onSurface }]}>{formatPrice(item.raised_cents)}</Text>
                  <Text style={[styles.goal, { color: colors.muted }]}>of {formatPrice(item.goal_cents)} · {item.backer_count} backers</Text>
                </View>

                {filter === "mine" ? (
                  <View style={[styles.mineActions, { borderTopColor: colors.border }]}>
                    <Pressable testID={`db-edit-${item.id}`} onPress={() => router.push(`/dreambacker/edit/${item.id}`)} style={styles.mineBtn}>
                      <MaterialCommunityIcons name="pencil" size={16} color={colors.brand} />
                      <Text style={[styles.mineBtnText, { color: colors.brand }]}>Edit</Text>
                    </Pressable>
                    <Pressable testID={`db-delete-${item.id}`} onPress={() => confirmDelete(item)} style={styles.mineBtn}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error ?? colors.muted} />
                      <Text style={[styles.mineBtnText, { color: colors.error ?? colors.muted }]}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Gathering the dreamers…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="hand-heart" title={filter === "mine" ? "You haven't launched a fundraiser yet" : "No fundraisers here yet"} subtitle="Tap + to start one and rally your backers." />
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ForgeButton label="Start a Fundraiser" fullWidth size="lg" testID="db-start-cta" onPress={() => router.push("/dreambacker/new")} icon={<MaterialCommunityIcons name="rocket-launch" size={18} color={colors.onBrandPrimary} />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  bellWrap: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  bellBadgeText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  filterChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  catFilterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  catFilterChip: { flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  catFilterText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  prompt: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  promptText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 140 },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badgeRow: { flexDirection: "row", gap: 6, flexShrink: 1 },
  fmBadge: { flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  fmBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  newBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, height: 20, paddingHorizontal: spacing.sm, borderRadius: radius.pill, marginTop: 6 },
  newBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: 4, lineHeight: 22 },
  cardCreator: { fontFamily: fonts.body, fontSize: 12.5 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: spacing.sm },
  fill: { height: 8, borderRadius: 4 },
  cardStatsRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.xs },
  raised: { fontFamily: fonts.displaySemi, fontSize: 16 },
  goal: { fontFamily: fonts.body, fontSize: 12.5 },
  mineActions: { flexDirection: "row", gap: spacing.lg, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm },
  mineBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  mineBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
});
