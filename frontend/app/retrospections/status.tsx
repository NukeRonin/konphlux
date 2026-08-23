import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroStatus, RetroStatusItem } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

const TABS: { key: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
  { key: "opening", label: "Opening Soon", icon: "storefront-outline", color: "#3182CE" },
  { key: "recent", label: "Recently Opened", icon: "storefront-check-outline", color: "#38A169" },
  { key: "health", label: "Health", icon: "clipboard-pulse-outline", color: "#805AD5" },
  { key: "closures", label: "Temporary Closures", icon: "store-clock-outline", color: "#DD6B20" },
  { key: "closing", label: "Closing Soon", icon: "store-off-outline", color: "#E53E3E" },
];

function daysPhrase(days?: number, future = true) {
  if (days == null) return "";
  const d = Math.abs(days);
  if (d === 0) return future ? "today" : "today";
  if (d === 1) return future ? "tomorrow" : "yesterday";
  if (d < 14) return future ? `in ${d} days` : `${d} days ago`;
  const w = Math.round(d / 7);
  return future ? `in ${w} weeks` : `${w} weeks ago`;
}

function GradeBadge({ grade }: { grade?: string }) {
  const color = grade === "A" ? "#38A169" : grade === "B" ? "#D69E2E" : "#E53E3E";
  return (
    <View style={[styles.grade, { backgroundColor: color }]}>
      <Text style={styles.gradeText}>{grade || "—"}</Text>
    </View>
  );
}

export default function BusinessStatus() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [data, setData] = useState<RetroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(TABS.some((t) => t.key === tab) ? (tab as string) : "opening");

  const load = useCallback(async () => {
    try { setData(await api.retroStatus()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = (it: RetroStatusItem, kind: string) => {
    const m = catMeta(it.category);
    let meta = "";
    let badge: React.ReactNode = null;
    if (kind === "opening") meta = `Opens ${daysPhrase(it.days, true)}`;
    else if (kind === "recent") meta = `Opened ${daysPhrase(it.days, false)}`;
    else if (kind === "closures") meta = it.days ? `Reopens ${daysPhrase(it.days, true)}` : "Temporarily closed";
    else if (kind === "closing") meta = it.days ? `Closing ${daysPhrase(it.days, true)}` : "Closing soon";
    else if (kind === "health") {
      let ago = "";
      try { const d = Math.round((Date.now() - new Date(it.date || "").getTime()) / 86400000); ago = daysPhrase(-d, false); } catch { ago = ""; }
      meta = `Score ${it.score} · inspected ${ago}`;
      badge = <GradeBadge grade={it.grade} />;
    }

    return (
      <Pressable key={it.id} onPress={() => router.push(`/retrospections/business/${it.id}`)}
        style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`status-${kind}-${it.id}`}>
        {it.image ? (
          <Image source={{ uri: it.image }} style={styles.img} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.img, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
            <MaterialCommunityIcons name={m.icon} size={22} color={m.color} />
          </View>
        )}
        <View style={{ flex: 1, padding: spacing.md }}>
          <View style={styles.cardTop}>
            <View style={[styles.catPill, { backgroundColor: `${m.color}22` }]}>
              <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
              <Text style={[styles.catText, { color: m.color }]}>{it.category}</Text>
            </View>
            {badge}
          </View>
          <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{it.name}</Text>
          <Text style={[styles.meta, { color: colors.brand }]}>{meta}</Text>
          {it.note ? <Text style={[styles.note, { color: colors.muted }]} numberOfLines={2}>{it.note}</Text> : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} style={{ alignSelf: "center", marginRight: spacing.sm }} />
      </Pressable>
    );
  };

  const listFor = (): { items: RetroStatusItem[]; kind: string; empty: string } => {
    if (!data) return { items: [], kind: active, empty: "" };
    if (active === "opening") return { items: data.opening_soon, kind: "opening", empty: "No new businesses opening soon right now." };
    if (active === "recent") return { items: data.recently_opened, kind: "recent", empty: "No businesses opened recently." };
    if (active === "health") return { items: data.inspections, kind: "health", empty: "No health inspection updates yet." };
    if (active === "closing") return { items: data.closing_soon, kind: "closing", empty: "No businesses closing soon. Good news!" };
    return { items: data.closures, kind: "closures", empty: "No temporary closures reported. All open!" };
  };
  const { items, kind, empty } = listFor();

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="status-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Business Status</Text>
          <Eyebrow>Live local updates</Eyebrow>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => {
          const on = active === t.key;
          return (
            <Pressable key={t.key} onPress={() => setActive(t.key)} testID={`status-tab-${t.key}`}
              style={[styles.tab, { backgroundColor: on ? t.color : colors.surfaceSecondary, borderColor: on ? t.color : colors.border }]}>
              <MaterialCommunityIcons name={t.icon} size={14} color={on ? "#fff" : t.color} />
              <Text style={[styles.tabText, { color: on ? "#fff" : colors.onSurface }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Loading label="Fetching local updates…" />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="information-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>{empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {items.map((it) => renderItem(it, kind))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  img: { width: 84, height: 96 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  meta: { fontFamily: fonts.bodyBold, fontSize: 12.5, marginTop: 3 },
  note: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  grade: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  gradeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
