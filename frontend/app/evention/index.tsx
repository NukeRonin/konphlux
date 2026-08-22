import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CalendarItem } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const TYPES: { key: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
  { key: "interview", label: "Interview", icon: "account-tie", color: "#3182CE" },
  { key: "meeting", label: "Meeting", icon: "account-group", color: "#805AD5" },
  { key: "flight", label: "Flight/Trip", icon: "airplane", color: "#DD6B20" },
  { key: "appointment", label: "Appointment", icon: "clock-outline", color: "#319795" },
  { key: "event", label: "Event", icon: "calendar-star", color: "#D53F8C" },
  { key: "birthday", label: "Birthday", icon: "cake-variant", color: "#38A169" },
];
const ADDABLE = TYPES.filter((t) => t.key !== "interview");

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}
function dayKey(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch { return iso; }
}

export default function CalendarView() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ upcoming: CalendarItem[]; past: CalendarItem[] }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [nType, setNType] = useState("meeting");
  const [nTitle, setNTitle] = useState("");
  const [nLoc, setNLoc] = useState("");
  const [nDay, setNDay] = useState(1);
  const [nHour, setNHour] = useState(9);

  const load = useCallback(async () => {
    try { setData(await api.eventionCalendar()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!nTitle.trim()) return;
    const d = new Date(); d.setDate(d.getDate() + nDay); d.setHours(nHour, 0, 0, 0);
    try {
      await api.eventionAddEvent({ type: nType, title: nTitle.trim(), when: d.toISOString(), location: nLoc.trim(), note: "" });
      setAdding(false); setNTitle(""); setNLoc(""); setNType("meeting"); setNDay(1); setNHour(9);
      await load();
    } catch { Alert.alert("Couldn't add", "Try again."); }
  };

  const remove = (item: CalendarItem) => {
    if (!item.deletable) { Alert.alert("Managed elsewhere", "Interviews are managed from Profession Plaza."); return; }
    Alert.alert("Delete", `Remove "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.eventionDeleteEvent(item.id); load(); } },
    ]);
  };

  const apply = (items: CalendarItem[]) => filter === "all" ? items : items.filter((i) => i.type === filter);
  const grouped = (items: CalendarItem[]) => {
    const map: Record<string, CalendarItem[]> = {};
    for (const i of apply(items)) { const k = dayKey(i.when); (map[k] ||= []).push(i); }
    return Object.entries(map);
  };
  const up = grouped(data.upcoming);
  const past = apply(data.past);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="cal-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Calendar</Text>
          <Eyebrow>Evention Center</Eyebrow>
        </View>
        <Pressable testID="cal-add" onPress={() => setAdding(true)} style={[styles.addBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.onBrandPrimary} />
          <Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Add</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.legend}>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} color={colors.brand} textColor={colors.onSurface} bg={colors.surfaceSecondary} border={colors.border} onBrand={colors.onBrandPrimary} />
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} dot={t.color} active={filter === t.key} onPress={() => setFilter(t.key)} color={t.color} textColor={colors.onSurface} bg={colors.surfaceSecondary} border={colors.border} onBrand="#fff" />
        ))}
      </ScrollView>

      {loading ? (
        <Loading label="Loading your calendar…" />
      ) : (up.length === 0 && past.length === 0) ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>Nothing scheduled. Tap Add to track meetings, flights, appointments, events and birthdays.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {up.map(([day, items]) => (
            <View key={day} style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.day, { color: colors.brand }]}>{day}</Text>
              {items.map((i) => <Row key={i.id} item={i} onLong={() => remove(i)} />)}
            </View>
          ))}
          {past.length > 0 ? (
            <>
              <Text style={[styles.day, { color: colors.muted, marginTop: spacing.sm }]}>Past</Text>
              {past.map((i) => <Row key={i.id} item={i} onLong={() => remove(i)} faded />)}
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAdding(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <KeyboardAwareScrollView bottomOffset={20} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Add to calendar</Text>
              <View style={styles.typeWrap}>
                {ADDABLE.map((t) => (
                  <Pressable key={t.key} onPress={() => setNType(t.key)} style={[styles.typePill, { backgroundColor: nType === t.key ? t.color : colors.surfaceSecondary, borderColor: nType === t.key ? t.color : colors.border }]} testID={`cal-type-${t.key}`}>
                    <MaterialCommunityIcons name={t.icon} size={14} color={nType === t.key ? "#fff" : t.color} />
                    <Text style={[styles.typeText, { color: nType === t.key ? "#fff" : colors.onSurface }]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={nTitle} onChangeText={setNTitle} placeholder="Title" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="cal-title" />
              <TextInput value={nLoc} onChangeText={setNLoc} placeholder="Location / note (optional)" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="cal-loc" />
              <Text style={[styles.mLabel, { color: colors.onSurface }]}>When</Text>
              <View style={styles.slotWrap}>
                {([["Today", 0], ["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7], ["In a month", 30]] as [string, number][]).map(([l, d]) => (
                  <Pressable key={l} onPress={() => setNDay(d)} style={[styles.slot, { backgroundColor: nDay === d ? colors.brand : colors.surfaceSecondary, borderColor: nDay === d ? colors.brand : colors.border }]}>
                    <Text style={[styles.slotText, { color: nDay === d ? colors.onBrandPrimary : colors.onSurface }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={[styles.slotWrap, { marginTop: spacing.sm }]}>
                {([["9:00", 9], ["12:00", 12], ["15:00", 15], ["18:00", 18]] as [string, number][]).map(([l, h]) => (
                  <Pressable key={h} onPress={() => setNHour(h)} style={[styles.slot, { backgroundColor: nHour === h ? colors.brand : colors.surfaceSecondary, borderColor: nHour === h ? colors.brand : colors.border }]}>
                    <Text style={[styles.slotText, { color: nHour === h ? colors.onBrandPrimary : colors.onSurface }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={add} disabled={!nTitle.trim()} style={[styles.saveBtn, { backgroundColor: nTitle.trim() ? colors.brand : colors.surfaceTertiary }]} testID="cal-save">
                <Text style={[styles.saveText, { color: nTitle.trim() ? colors.onBrandPrimary : colors.muted }]}>Add to calendar</Text>
              </Pressable>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ item, onLong, faded }: { item: CalendarItem; onLong: () => void; faded?: boolean }) {
  const { colors } = useTheme();
  const t = TYPES.find((x) => x.key === item.type);
  return (
    <Pressable onLongPress={onLong} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: faded ? 0.6 : 1 }]} testID={`cal-item-${item.id}`}>
      <View style={[styles.stripe, { backgroundColor: item.color }]} />
      <View style={[styles.rowIcon, { backgroundColor: `${item.color}22` }]}>
        <MaterialCommunityIcons name={t?.icon || "calendar"} size={18} color={item.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{fmt(item.when)}{item.location ? ` · ${item.location}` : ""}{item.note ? ` · ${item.note}` : ""}</Text>
      </View>
      {item.status ? <Text style={[styles.rowStatus, { color: item.color }]}>{item.status}</Text> : null}
    </Pressable>
  );
}

function Chip({ label, active, onPress, dot, bg, border, textColor, onBrand, color }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, { backgroundColor: active ? (dot || color) : bg, borderColor: active ? (dot || color) : border }]}>
      {dot && !active ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.filterText, { color: active ? onBrand : textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  addText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  legend: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1 },
  filterText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  day: { fontFamily: fonts.displaySemi, fontSize: 14, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, paddingRight: spacing.md, marginBottom: spacing.sm, overflow: "hidden" },
  stripe: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rowIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rowStatus: { fontFamily: fonts.bodyBold, fontSize: 10.5, textTransform: "uppercase" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.lg, maxHeight: "85%" },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  typeWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  typePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1 },
  typeText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, marginBottom: spacing.sm },
  mLabel: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.sm },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  slotText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  saveBtn: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
