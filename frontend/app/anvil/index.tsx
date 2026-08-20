import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AnvilWork } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

type Kind = "story" | "script";
const KINDS: { key: Kind; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "story", label: "Stories", icon: "book-open-variant" },
  { key: "script", label: "Scripts", icon: "script-text" },
];
const QUICK: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; route: string }[] = [
  { label: "Write", icon: "feather", route: "/anvil/write" },
  { label: "Prompts", icon: "lightbulb-on", route: "/anvil/prompts" },
  { label: "Co-writing", icon: "account-multiple", route: "/anvil/cowriting" },
  { label: "AIventure", icon: "compass-rose", route: "/anvil/aiventure" },
];

function WorkRow({ work }: { work: AnvilWork }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`work-${work.id}`}
      onPress={() => router.push(`/anvil/work/${work.id}`)}
      style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={styles.rowTop}>
        <View style={[styles.kindPill, { backgroundColor: colors.surfaceTertiary }]}>
          <MaterialCommunityIcons name={work.kind === "script" ? "script-text" : "book-open-variant"} size={11} color={colors.brand} />
          <Text style={[styles.kindText, { color: colors.brand }]}>{work.kind === "script" ? "Script" : "Story"}</Text>
        </View>
        <View style={[styles.catPill, { backgroundColor: colors.surfaceTertiary }]}>
          <Text style={[styles.kindText, { color: colors.muted }]}>{work.category}</Text>
        </View>
        {work.open_cowriting ? <MaterialCommunityIcons name="account-multiple" size={15} color={colors.aether} /> : null}
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{work.title}</Text>
      <Text numberOfLines={2} style={[styles.excerpt, { color: colors.muted }]}>{work.excerpt}</Text>
      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: colors.muted }]}>{work.author}</Text>
        <MaterialCommunityIcons name="hand-clap" size={13} color={colors.brandSecondary} />
        <Text style={[styles.metaText, { color: colors.muted }]}>{compactNumber(work.applause)}</Text>
        <Text style={[styles.metaText, { color: colors.muted }]}>· {timeAgo(work.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function AnvilHub() {
  const params = useLocalSearchParams<{ kind?: string; category?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>(params.kind === "script" ? "script" : "story");
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [data, setData] = useState<{ works: AnvilWork[]; categories: string[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setData(await api.anvilList());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(() => {
    if (!data) return [];
    return data.works.filter((w) => w.kind === kind && (!category || w.category === category));
  }, [data, kind, category]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="anvil-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Author Anvil</Text>
          <Eyebrow>Hammer out your story</Eyebrow>
        </View>
        <Pressable testID="anvil-write-btn" onPress={() => router.push(`/anvil/write?kind=${kind}`)} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="feather" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => <WorkRow work={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Quick actions */}
            <View style={styles.quickRow}>
              {QUICK.map((q) => (
                <Pressable key={q.label} testID={`quick-${q.label}`} onPress={() => router.push(q.route as any)} style={[styles.quick, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={q.icon} size={22} color={colors.brand} />
                  <Text style={[styles.quickText, { color: colors.onSurface }]}>{q.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Kind tabs */}
            <View style={styles.tabs}>
              {KINDS.map((k) => (
                <Pressable key={k.key} testID={`kind-${k.key}`} onPress={() => setKind(k.key)} style={[styles.tab, { backgroundColor: kind === k.key ? colors.brand : colors.surfaceSecondary, borderColor: kind === k.key ? colors.brand : colors.border }]}>
                  <MaterialCommunityIcons name={k.icon} size={16} color={kind === k.key ? colors.onBrandPrimary : colors.brand} />
                  <Text style={[styles.tabText, { color: kind === k.key ? colors.onBrandPrimary : colors.onSurface }]}>{k.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              <Pressable testID="anvil-cat-all" onPress={() => setCategory(null)} style={[styles.catChip, { backgroundColor: !category ? colors.surfaceTertiary : "transparent", borderColor: !category ? colors.brand : colors.border }]}>
                <Text style={[styles.catChipText, { color: !category ? colors.brand : colors.muted }]}>All</Text>
              </Pressable>
              {(data?.categories ?? []).map((c) => (
                <Pressable key={c} testID={`anvil-cat-${c}`} onPress={() => setCategory(category === c ? null : c)} style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}>
                  <Text style={[styles.catChipText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          status === "loading" ? (
            <Loading label="Warming the forge…" />
          ) : status === "error" ? (
            <ErrorState onRetry={load} />
          ) : (
            <EmptyState icon="feather" title={`No ${kind === "script" ? "scripts" : "stories"} yet`} subtitle="Be the first to publish — tap the quill above." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  quickRow: { flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.md },
  quick: { flex: 1, height: 74, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  quickText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  catRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  catChip: { height: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  catChipText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  row: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kindPill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  catPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  kindText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  title: { fontFamily: fonts.display, fontSize: 18, marginTop: 4 },
  excerpt: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  metaText: { fontFamily: fonts.body, fontSize: 12 },
});
