import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TrackerEntry, Trackers } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import TreasuryGate from "@/src/components/TreasuryGate";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const money = (c: number) => `£${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SOURCES: { key: "dreambacker" | "bazaar" | "waypoint" | "retrospections"; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; noun: string }[] = [
  { key: "dreambacker", label: "Dreambacker", icon: "hand-heart", color: "#D53F8C", noun: "Donations" },
  { key: "bazaar", label: "Bazaar", icon: "shopping", color: "#DD6B20", noun: "Spends" },
  { key: "waypoint", label: "Waypoint", icon: "map-marker-radius", color: "#3182CE", noun: "Deals" },
  { key: "retrospections", label: "Retrospections", icon: "store-search-outline", color: "#805AD5", noun: "Deals" },
];

function entryDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}

export default function TrackersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [data, setData] = useState<Trackers | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(SOURCES.some((s) => s.key === source) ? (source as string) : "dreambacker");

  const load = useCallback(async () => {
    try { setData(await api.treasuryTrackers()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const meta = SOURCES.find((s) => s.key === active)!;
  const entries: TrackerEntry[] = data ? data.sections[meta.key] : [];
  const total = data ? data.totals[meta.key] : 0;

  return (
    <TreasuryGate>
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="trackers-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>District Trackers</Text>
          <Eyebrow>Treasury · cross-district activity</Eyebrow>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabs}>
        {SOURCES.map((s) => {
          const on = active === s.key;
          return (
            <Pressable key={s.key} onPress={() => setActive(s.key)} testID={`tracker-tab-${s.key}`}
              style={[styles.tab, { backgroundColor: on ? s.color : colors.surfaceSecondary, borderColor: on ? s.color : colors.border }]}>
              <MaterialCommunityIcons name={s.icon} size={14} color={on ? "#fff" : s.color} />
              <Text style={[styles.tabText, { color: on ? "#fff" : colors.onSurface }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading || !data ? (
        <Loading label="Gathering activity…" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={[styles.summary, { backgroundColor: `${meta.color}1A`, borderColor: meta.color }]}>
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>{meta.noun} in {meta.label}</Text>
              <Text style={[styles.summaryValue, { color: meta.color }]}>{money(total)} · {entries.length} {entries.length === 1 ? "entry" : "entries"}</Text>
            </View>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="book-open-variant" size={38} color={colors.muted} />
              <Text style={[styles.empty, { color: colors.muted }]}>No {meta.noun.toLowerCase()} recorded in {meta.label} yet.</Text>
            </View>
          ) : (
            entries.map((e) => (
              <Pressable key={e.id} onPress={() => router.push(e.link as any)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`tracker-entry-${e.id}`}>
                <View style={[styles.rowIcon, { backgroundColor: `${meta.color}22` }]}>
                  <MaterialCommunityIcons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{e.title}</Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{entryDate(e.created_at)}{e.subtitle ? ` · ${e.subtitle}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {e.amount_cents > 0 ? <Text style={[styles.rowAmt, { color: colors.onSurface }]}>{money(e.amount_cents)}</Text> : null}
                  <View style={styles.linkTag}>
                    <Text style={[styles.linkText, { color: meta.color }]}>View</Text>
                    <MaterialCommunityIcons name="arrow-top-right" size={13} color={meta.color} />
                  </View>
                </View>
              </Pressable>
            ))
          )}
          <Text style={[styles.footHint, { color: colors.muted }]}>Tap any entry to open it in {meta.label}.</Text>
        </ScrollView>
      )}
    </View>
    </TreasuryGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  summaryLabel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  summaryValue: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rowAmt: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  linkTag: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl },
  empty: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 21 },
  footHint: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.md },
});
