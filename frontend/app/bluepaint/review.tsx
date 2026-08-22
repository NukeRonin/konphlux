import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BPDesignSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type ReviewResult = {
  summary: { wall_count: number; total_wall_len: number; bbox_w: number; bbox_d: number; floor_area: number; doors: number; windows: number; furniture: Record<string, number> };
  review: string;
};

const SECTION_META: Record<string, { icon: IconName; label: string }> = {
  OVERALL: { icon: "star-four-points", label: "Overall" },
  "TRAFFIC FLOW": { icon: "swap-horizontal", label: "Traffic flow" },
  "NATURAL LIGHT": { icon: "white-balance-sunny", label: "Natural light" },
  "ROOM SIZES": { icon: "ruler-square", label: "Room sizes" },
  SUGGESTIONS: { icon: "lightbulb-on-outline", label: "Suggestions" },
};

function parseSections(text: string): { key: string; body: string }[] {
  const known = Object.keys(SECTION_META);
  const lines = text.split("\n");
  const out: { key: string; body: string }[] = [];
  let current: { key: string; body: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const header = known.find((h) => line.toUpperCase().startsWith(h + ":") || line.toUpperCase() === h);
    if (header) {
      if (current) out.push(current);
      const rest = line.slice(line.indexOf(":") + 1).trim();
      current = { key: header, body: rest };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      out.push({ key: "OVERALL", body: line });
      current = out[out.length - 1];
    }
  }
  if (current && (!out.length || out[out.length - 1] !== current)) out.push(current);
  return out.filter((s) => s.body);
}

export default function DesignReview() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<BPDesignSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [planWidth, setPlanWidth] = useState(8);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const list = await api.bpDesigns();
      setDesigns(list);
      if (list.length && !list.find((d) => d.id === selected)) setSelected(list[0].id);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [selected]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runReview = async () => {
    if (!selected || reviewing) return;
    setReviewing(true);
    setResult(null);
    setErrMsg("");
    try {
      const res = await api.bpReview(selected, planWidth);
      setResult(res);
    } catch (e: any) {
      setErrMsg(e?.message || "Iris couldn't review this design. Draw some walls first, then try again.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="review-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Design Reviews with Iris</Text>
          <Eyebrow>Professional critique of your floor plan</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Fetching your blueprints…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : designs.length === 0 ? (
        <EmptyState icon="floor-plan" title="No designs yet" subtitle="Draw a floor plan in Space Designer first, then bring it to Iris." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={[styles.iris, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.irisAvatar, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name="eye-check" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.irisName, { color: colors.onSurface }]}>Iris · Grand Visionary</Text>
              <Text style={[styles.irisMsg, { color: colors.muted }]}>Pick a design and I&apos;ll critique its flow, light and proportions like a seasoned architect.</Text>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Design</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {designs.map((d) => (
              <Pressable
                key={d.id}
                testID={`review-design-${d.id}`}
                onPress={() => { setSelected(d.id); setResult(null); setErrMsg(""); }}
                style={[styles.chip, { backgroundColor: selected === d.id ? colors.surfaceTertiary : "transparent", borderColor: selected === d.id ? colors.brand : colors.border }]}
              >
                <Text style={[styles.chipText, { color: selected === d.id ? colors.brand : colors.muted }]}>{d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.onSurface }]}>Plan width (for scale)</Text>
          <View style={[styles.scaleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable testID="review-scale-down" onPress={() => setPlanWidth((s) => Math.max(2, s - 1))} hitSlop={8} style={styles.scaleBtn}>
              <MaterialCommunityIcons name="minus" size={20} color={colors.brand} />
            </Pressable>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.scaleValue, { color: colors.onSurface }]}>{planWidth} m ({Math.round(planWidth * 3.28084)} ft)</Text>
              <Text style={[styles.scaleHint, { color: colors.muted }]}>width of the whole plan</Text>
            </View>
            <Pressable testID="review-scale-up" onPress={() => setPlanWidth((s) => Math.min(40, s + 1))} hitSlop={8} style={styles.scaleBtn}>
              <MaterialCommunityIcons name="plus" size={20} color={colors.brand} />
            </Pressable>
          </View>

          <ForgeButton label="Review with Iris" fullWidth size="lg" loading={reviewing} onPress={runReview} testID="review-run" style={{ marginTop: spacing.lg }} />

          {errMsg ? (
            <View style={[styles.warn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.muted} />
              <Text style={[styles.warnText, { color: colors.muted }]}>{errMsg}</Text>
            </View>
          ) : null}

          {result ? (
            <>
              <View style={styles.statRow}>
                <Stat colors={colors} value={`${result.summary.bbox_w}×${result.summary.bbox_d} m`} label="Footprint" />
                <Stat colors={colors} value={`${result.summary.floor_area} m²`} label="Floor area" />
              </View>
              <View style={styles.statRow}>
                <Stat colors={colors} value={`${result.summary.doors}`} label="Doors" />
                <Stat colors={colors} value={`${result.summary.windows}`} label="Windows" />
                <Stat colors={colors} value={`${result.summary.wall_count}`} label="Walls" />
              </View>

              {parseSections(result.review).map((sec, i) => {
                const meta = SECTION_META[sec.key] ?? { icon: "text" as IconName, label: sec.key };
                return (
                  <View key={`${sec.key}-${i}`} style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <View style={styles.sectionHead}>
                      <MaterialCommunityIcons name={meta.icon} size={18} color={colors.brand} />
                      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{meta.label}</Text>
                    </View>
                    <Text style={[styles.sectionBody, { color: colors.onSurface }]}>{sec.body}</Text>
                  </View>
                );
              })}
              <Text style={[styles.disclaimer, { color: colors.muted }]}>Iris&apos;s review is expert guidance, not a substitute for a licensed architect or local building code sign-off.</Text>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ colors, value, label }: { colors: any; value: string; label: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iris: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  irisAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  irisName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  irisMsg: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: spacing.sm, marginTop: spacing.sm },
  chipRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  scaleRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  scaleBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  scaleValue: { fontFamily: fonts.display, fontSize: 18 },
  scaleHint: { fontFamily: fonts.body, fontSize: 11 },
  warn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  stat: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingVertical: spacing.md, gap: 2 },
  statValue: { fontFamily: fonts.displaySemi, fontSize: 15 },
  statLabel: { fontFamily: fonts.body, fontSize: 11 },
  section: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 14 },
  sectionBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20 },
  disclaimer: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.lg },
});
