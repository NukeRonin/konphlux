import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CalendarItem } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  interview: "account-tie", meeting: "account-group", flight: "airplane",
  appointment: "clock-outline", event: "calendar-star", birthday: "cake-variant",
};

const VIEWS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}

export default function AgendaView() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");

  const load = useCallback(async () => {
    try {
      const d = await api.eventionCalendar();
      setItems([...d.upcoming, ...d.past]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay())); // through end of Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const parsed = items
      .map((i) => ({ i, d: new Date(i.when) }))
      .filter((x) => !isNaN(x.d.getTime()));

    let out: typeof parsed;
    if (view === "today") out = parsed.filter((x) => sameDay(x.d, now));
    else if (view === "tomorrow") out = parsed.filter((x) => sameDay(x.d, tomorrow));
    else if (view === "week") out = parsed.filter((x) => x.d >= today && x.d <= endOfWeek);
    else out = parsed.filter((x) => x.d >= today && x.d <= endOfMonth);

    out.sort((a, b) => a.d.getTime() - b.d.getTime());
    return out.map((x) => x.i);
  }, [items, view]);

  const label = VIEWS.find((v) => v.key === view)?.label || "";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="agenda-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Agendas</Text>
          <Eyebrow>Evention Center</Eyebrow>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabs}>
        {VIEWS.map((v) => (
          <Pressable key={v.key} onPress={() => setView(v.key)} testID={`agenda-tab-${v.key}`}
            style={[styles.tab, { backgroundColor: view === v.key ? colors.brand : colors.surfaceSecondary, borderColor: view === v.key ? colors.brand : colors.border }]}>
            <Text style={[styles.tabText, { color: view === v.key ? colors.onBrandPrimary : colors.onSurface }]}>{v.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <Loading label="Loading your agenda…" />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="calendar-check-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>Nothing on your agenda for {label.toLowerCase()}. Add items from the Calendar.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.count, { color: colors.muted }]}>{filtered.length} {filtered.length === 1 ? "item" : "items"} · {label}</Text>
          {filtered.map((i) => (
            <View key={i.id} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.stripe, { backgroundColor: i.color }]} />
              <View style={[styles.rowIcon, { backgroundColor: `${i.color}22` }]}>
                <MaterialCommunityIcons name={ICONS[i.type] || "calendar"} size={18} color={i.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{i.title}</Text>
                <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{fmtTime(i.when)}{i.location ? ` · ${i.location}` : ""}</Text>
              </View>
              {i.status ? <Text style={[styles.rowStatus, { color: i.color }]}>{i.status}</Text> : null}
            </View>
          ))}
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
  tab: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  count: { fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, paddingRight: spacing.md, marginBottom: spacing.sm, overflow: "hidden" },
  stripe: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rowIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rowStatus: { fontFamily: fonts.bodyBold, fontSize: 10.5, textTransform: "uppercase" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
