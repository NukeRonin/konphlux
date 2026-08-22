import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BPDesign, BPDesignSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const WALL_HEIGHT = 2.4; // metres
const PAINT_COVERAGE = 10; // m² per litre
const PAINT_COATS = 2;
const PAINT_CAN = 2.5; // litres per can
const BOARD_LEN = 2.4; // metres per timber board
const FLOOR_PER_BOX = 2; // m² per flooring box

function useEstimate(design: BPDesign | null, scale: number) {
  return useMemo(() => {
    if (!design) return null;
    const walls = design.walls;
    let wallLen = 0;
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    let has = false;
    for (const w of walls) {
      wallLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * scale;
      minx = Math.min(minx, w.x1, w.x2);
      miny = Math.min(miny, w.y1, w.y2);
      maxx = Math.max(maxx, w.x1, w.x2);
      maxy = Math.max(maxy, w.y1, w.y2);
      has = true;
    }
    const floorArea = has ? Math.max(0, (maxx - minx) * scale) * Math.max(0, (maxy - miny) * scale) : 0;
    const paintArea = wallLen * WALL_HEIGHT;
    const paintLitres = Math.ceil((paintArea * PAINT_COATS) / PAINT_COVERAGE);
    const paintCans = Math.ceil(paintLitres / PAINT_CAN) || 0;
    const woodLinear = Math.round(wallLen * 3);
    const woodBoards = Math.ceil(woodLinear / BOARD_LEN) || 0;
    const flooringM2 = Math.round(floorArea);
    const flooringBoxes = Math.ceil(flooringM2 / FLOOR_PER_BOX) || 0;
    return {
      hasWalls: has,
      wallLen: Math.round(wallLen),
      paintArea: Math.round(paintArea),
      paintLitres, paintCans,
      woodLinear, woodBoards,
      floorArea: flooringM2, flooringBoxes,
    };
  }, [design, scale]);
}

export default function MaterialsEstimator() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<BPDesignSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [design, setDesign] = useState<BPDesign | null>(null);
  const [scale, setScale] = useState(8);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const list = await api.bpDesigns();
      setDesigns(list);
      if (list.length) {
        const pick = selected && list.find((d) => d.id === selected) ? selected : list[0].id;
        setSelected(pick);
        setDesign(await api.bpDesign(pick));
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [selected]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chooseDesign = async (id: string) => {
    setSelected(id);
    setDesign(null);
    try {
      setDesign(await api.bpDesign(id));
    } catch {
      /* ignore */
    }
  };

  const est = useEstimate(design, scale);

  const materialCard = (icon: IconName, title: string, primary: string, secondary: string, query: string) => (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={[styles.cardIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.cardPrimary, { color: colors.brand }]}>{primary}</Text>
        <Text style={[styles.cardSecondary, { color: colors.muted }]}>{secondary}</Text>
      </View>
      <Pressable testID={`estimator-find-${query}`} onPress={() => router.push(`/(tabs)/bazaar?q=${encodeURIComponent(query)}`)} hitSlop={8} style={[styles.findBtn, { borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={16} color={colors.brand} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="estimator-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Materials Estimator</Text>
          <Eyebrow>Auto-calculated from your plan</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Measuring the blueprint…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : designs.length === 0 ? (
        <EmptyState icon="floor-plan" title="No designs yet" subtitle="Create a design in Space Designer first, then come back to estimate materials." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Design picker */}
          <Text style={[styles.label, { color: colors.onSurface }]}>Design</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {designs.map((d) => (
              <Pressable key={d.id} testID={`estimator-design-${d.id}`} onPress={() => chooseDesign(d.id)} style={[styles.chip, { backgroundColor: selected === d.id ? colors.surfaceTertiary : "transparent", borderColor: selected === d.id ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: selected === d.id ? colors.brand : colors.muted }]}>{d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Scale */}
          <Text style={[styles.label, { color: colors.onSurface }]}>Plan width</Text>
          <View style={[styles.scaleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable testID="estimator-scale-down" onPress={() => setScale((s) => Math.max(2, s - 1))} hitSlop={8} style={styles.scaleBtn}>
              <MaterialCommunityIcons name="minus" size={20} color={colors.brand} />
            </Pressable>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.scaleValue, { color: colors.onSurface }]}>{scale} m</Text>
              <Text style={[styles.scaleHint, { color: colors.muted }]}>width of the whole plan</Text>
            </View>
            <Pressable testID="estimator-scale-up" onPress={() => setScale((s) => Math.min(40, s + 1))} hitSlop={8} style={styles.scaleBtn}>
              <MaterialCommunityIcons name="plus" size={20} color={colors.brand} />
            </Pressable>
          </View>

          {!design ? (
            <Loading label="Loading design…" />
          ) : !est?.hasWalls ? (
            <View style={[styles.warn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.muted} />
              <Text style={[styles.warnText, { color: colors.muted }]}>This design has no walls yet. Draw a floor plan in Space Designer to estimate materials.</Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.summaryNum, { color: colors.onSurface }]}>{est.wallLen} m</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Wall length</Text>
                </View>
                <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.summaryNum, { color: colors.onSurface }]}>{est.floorArea} m²</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Floor area</Text>
                </View>
              </View>

              <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Materials needed</Text>
              {materialCard("format-paint", "Paint", `${est.paintLitres} L`, `≈ ${est.paintCans} cans (2.5 L) · ${PAINT_COATS} coats over ${est.paintArea} m²`, "paint")}
              {materialCard("wall", "Timber / Wood", `${est.woodLinear} m`, `≈ ${est.woodBoards} boards (2.4 m) for framing`, "wood")}
              {materialCard("view-grid", "Flooring", `${est.floorArea} m²`, `≈ ${est.flooringBoxes} boxes (2 m² each)`, "flooring")}

              <ForgeButton
                label="Purchase in Bazaar"
                fullWidth
                size="lg"
                onPress={() => router.push(`/(tabs)/bazaar?q=${encodeURIComponent("paint wood flooring")}`)}
                testID="estimator-purchase"
                style={{ marginTop: spacing.lg }}
              />
              <Text style={[styles.disclaimer, { color: colors.muted }]}>Estimates are guidance only. Add ~10% for waste and offcuts.</Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  scaleRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  scaleBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  scaleValue: { fontFamily: fonts.display, fontSize: 20 },
  scaleHint: { fontFamily: fonts.body, fontSize: 11 },
  warn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  summary: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingVertical: spacing.md, gap: 2 },
  summaryNum: { fontFamily: fonts.display, fontSize: 20 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  cardIcon: { width: 46, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  cardPrimary: { fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 1 },
  cardSecondary: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  findBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  disclaimer: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.md },
});
