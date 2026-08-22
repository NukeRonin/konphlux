import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Interview } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; }
}
const statusColor = (s: string) => ({ proposed: "#B7791F", confirmed: "#2F855A", declined: "#C53030" } as Record<string, string>)[s] || "#718096";

export default function UpcomingInterviews() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ upcoming: Interview[]; past: Interview[] }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [reschedId, setReschedId] = useState("");

  const load = useCallback(async () => {
    try { setData(await api.eventionInterviews()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const slots: { label: string; iso: string }[] = (() => {
    const out: { label: string; iso: string }[] = [];
    for (const [dl, days] of [["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]] as [string, number][]) {
      for (const h of [10, 14, 16]) {
        const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0);
        out.push({ label: `${dl} ${h}:00`, iso: d.toISOString() });
      }
    }
    return out;
  })();

  const reschedule = async (iso: string) => {
    try { await api.rescheduleInterview(reschedId, iso); setReschedId(""); await load(); }
    catch { Alert.alert("Couldn't reschedule", "Try again."); }
  };

  const respond = (iv: Interview, status: "confirmed" | "declined") => {
    Alert.alert(status === "confirmed" ? "Confirm interview" : "Decline interview", iv.title, [
      { text: "Cancel", style: "cancel" },
      { text: status === "confirmed" ? "Confirm" : "Decline", style: status === "declined" ? "destructive" : "default", onPress: async () => { await api.respondInterview(iv.id, status); load(); } },
    ]);
  };

  const Card = ({ iv, upcoming }: { iv: Interview; upcoming: boolean }) => {
    const other = iv.role === "poster" ? iv.applicant_name : iv.poster_name;
    const canRespond = upcoming && iv.role === "applicant" && iv.status === "proposed";
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceTertiary }]}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{iv.title}</Text>
            <Text style={[styles.when, { color: colors.brand }]}>{fmt(iv.scheduled_at)}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: `${statusColor(iv.status)}22`, borderColor: statusColor(iv.status) }]}>
            <Text style={[styles.pillText, { color: statusColor(iv.status) }]}>{iv.status}</Text>
          </View>
        </View>
        <Text style={[styles.meta, { color: colors.muted }]}>{iv.role === "poster" ? "With applicant" : "With"} {other}{iv.location ? ` · ${iv.location}` : ""}</Text>
        {canRespond ? (
          <View style={styles.btns}>
            <Pressable onPress={() => respond(iv, "confirmed")} style={[styles.btn, { backgroundColor: colors.brand }]} testID={`iv-confirm-${iv.id}`}>
              <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>Confirm</Text>
            </Pressable>
            <Pressable onPress={() => respond(iv, "declined")} style={[styles.btn, { borderColor: colors.border, borderWidth: 1 }]} testID={`iv-decline-${iv.id}`}>
              <Text style={[styles.btnText, { color: colors.onSurface }]}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
        {upcoming && iv.status !== "declined" ? (
          <Pressable onPress={() => setReschedId(iv.id)} style={styles.reschedLink} testID={`iv-resched-${iv.id}`}>
            <MaterialCommunityIcons name="calendar-refresh" size={15} color={colors.brand} />
            <Text style={[styles.reschedText, { color: colors.brand }]}>Propose a new time</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="iv-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Upcoming Interviews</Text>
          <Eyebrow>Evention Center</Eyebrow>
        </View>
      </View>

      {loading ? (
        <Loading label="Loading your schedule…" />
      ) : (data.upcoming.length === 0 && data.past.length === 0) ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>No interviews yet. Schedule one from a chat in Profession Plaza and it&apos;ll appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {data.upcoming.length > 0 ? <Text style={[styles.section, { color: colors.onSurface }]}>Upcoming</Text> : null}
          {data.upcoming.map((iv) => <Card key={iv.id} iv={iv} upcoming />)}
          {data.past.length > 0 ? <Text style={[styles.section, { color: colors.onSurface, marginTop: spacing.lg }]}>Past</Text> : null}
          {data.past.map((iv) => <Card key={iv.id} iv={iv} upcoming={false} />)}
        </ScrollView>
      )}

      <Modal visible={!!reschedId} transparent animationType="slide" onRequestClose={() => setReschedId("")}>
        <Pressable style={styles.backdrop} onPress={() => setReschedId("")}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Propose a new time</Text>
            <View style={styles.slotWrap}>
              {slots.map((s) => (
                <Pressable key={s.iso} onPress={() => reschedule(s.iso)} style={[styles.slot, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`resched-slot`}>
                  <Text style={[styles.slotText, { color: colors.onSurface }]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  section: { fontFamily: fonts.display, fontSize: 18 },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 15.5 },
  when: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 2 },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12.5, marginTop: spacing.sm },
  btns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
  reschedLink: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.md },
  reschedText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  slotText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
});
