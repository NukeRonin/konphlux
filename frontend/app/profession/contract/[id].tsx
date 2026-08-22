import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Contract } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ContractView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try { setC(await api.contract(id)); } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Opening agreement…" /></View>;
  if (!c) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xxl }}>Agreement not found.</Text></View>;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.onSurface }]}>{value || "—"}</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="ct-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Agreement</Text>
          <Eyebrow>Profession Plaza</Eyebrow>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={[styles.badge, { backgroundColor: "#2F855A22", borderColor: "#2F855A" }]}>
          <MaterialCommunityIcons name="check-decagram" size={16} color="#2F855A" />
          <Text style={[styles.badgeText, { color: "#2F855A" }]}>Accepted · {c.status}</Text>
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>{c.title}</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary }]}>
          <Row label="Client" value={c.client_name} />
          <Row label="Freelancer" value={c.freelancer_name} />
          <Row label="Rate" value={c.rate_text} />
          <Row label="Scope / notes" value={c.note} />
          <Row label="Agreed on" value={new Date(c.accepted_at).toLocaleString()} />
        </View>
        <Text style={[styles.foot, { color: colors.muted }]}>This is a simple record of the accepted offer that both parties can view. It is not a formal legal contract.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  title: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md },
  card: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  row: { borderBottomWidth: 1, paddingVertical: spacing.md },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  rowValue: { fontFamily: fonts.body, fontSize: 15, marginTop: 3, lineHeight: 21 },
  foot: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: spacing.lg },
});
