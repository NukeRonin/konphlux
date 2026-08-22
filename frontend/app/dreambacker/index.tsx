import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, DBProject } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { FUNDING_MODELS, timeLeft } from "@/src/utils/dreambacker";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "trending", label: "Trending" },
  { key: "popular", label: "Popular" },
  { key: "deadline", label: "Near Deadline" },
  { key: "mine", label: "Mine" },
];

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
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setProjects(await api.dbProjects(filter));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const fm = FUNDING_MODELS[item.funding_model];
          return (
            <Pressable testID={`db-project-${item.id}`} onPress={() => router.push(`/dreambacker/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.fmBadge, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={fm.icon as IconName} size={12} color={colors.brand} />
                  <Text style={[styles.fmBadgeText, { color: colors.brand }]}>{fm.label}</Text>
                </View>
                <Countdown deadline={item.deadline} color={colors.brand} muted={colors.muted} />
              </View>
              <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.cardCreator, { color: colors.muted }]}>by {item.creator_name}</Text>

              <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                <View style={[styles.fill, { backgroundColor: colors.brand, width: `${Math.round(item.progress * 100)}%` }]} />
              </View>
              <View style={styles.cardStatsRow}>
                <Text style={[styles.raised, { color: colors.onSurface }]}>{formatPrice(item.raised_cents)}</Text>
                <Text style={[styles.goal, { color: colors.muted }]}>of {formatPrice(item.goal_cents)} · {item.backer_count} backers</Text>
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
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  filterChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fmBadge: { flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  fmBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: 4, lineHeight: 22 },
  cardCreator: { fontFamily: fonts.body, fontSize: 12.5 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: spacing.sm },
  fill: { height: 8, borderRadius: 4 },
  cardStatsRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.xs },
  raised: { fontFamily: fonts.displaySemi, fontSize: 16 },
  goal: { fontFamily: fonts.body, fontSize: 12.5 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
});
