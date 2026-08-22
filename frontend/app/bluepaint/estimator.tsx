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
import { computeEstimate, fmtArea, fmtLen, MATERIAL_IDS } from "@/src/utils/bpEstimate";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function MaterialsEstimator() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<BPDesignSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [design, setDesign] = useState<BPDesign | null>(null);
  const [scale, setScale] = useState(8);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [list, bazaar] = await Promise.all([api.bpDesigns(), api.getBazaar()]);
      setDesigns(list);
      const p: Record<string, number> = {};
      for (const l of bazaar.listings) p[l.id] = l.price_cents;
      setPrices(p);
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
    setAddedMsg("");
    try {
      setDesign(await api.bpDesign(id));
    } catch {
      /* ignore */
    }
  };

  const est = useMemo(() => (design ? computeEstimate(design.walls, scale) : null), [design, scale]);

  const costs = useMemo(() => {
    if (!est) return null;
    const paint = (prices[MATERIAL_IDS.paint] ?? 0) * est.paintCans;
    const wood = (prices[MATERIAL_IDS.wood] ?? 0) * est.woodBoards;
    const floor = (prices[MATERIAL_IDS.floor] ?? 0) * est.flooringM2;
    return { paint, wood, floor, total: paint + wood + floor };
  }, [est, prices]);

  const purchase = async () => {
    if (!est || adding) return;
    setAdding(true);
    try {
      if (est.paintCans > 0) await api.addToCart(MATERIAL_IDS.paint, est.paintCans);
      if (est.woodBoards > 0) await api.addToCart(MATERIAL_IDS.wood, est.woodBoards);
      if (est.flooringM2 > 0) await api.addToCart(MATERIAL_IDS.floor, est.flooringM2);
      setAddedMsg("Added to your cart!");
      setTimeout(() => router.push("/cart"), 700);
    } catch {
      setAddedMsg("Couldn't add to cart. Try again.");
      setAdding(false);
    }
  };

  const materialCard = (icon: IconName, title: string, primary: string, secondary: string, cost: number) => (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={[styles.cardIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.cardPrimary, { color: colors.brand }]}>{primary}</Text>
        <Text style={[styles.cardSecondary, { color: colors.muted }]}>{secondary}</Text>
      </View>
      <Text style={[styles.cardCost, { color: colors.onSurface }]}>{formatPrice(cost)}</Text>
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
          <Text style={[styles.label, { color: colors.onSurface }]}>Design</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {designs.map((d) => (
              <Pressable key={d.id} testID={`estimator-design-${d.id}`} onPress={() => chooseDesign(d.id)} style={[styles.chip, { backgroundColor: selected === d.id ? colors.surfaceTertiary : "transparent", borderColor: selected === d.id ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: selected === d.id ? colors.brand : colors.muted }]}>{d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.onSurface }]}>Plan width</Text>
          <View style={[styles.scaleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable testID="estimator-scale-down" onPress={() => setScale((s) => Math.max(2, s - 1))} hitSlop={8} style={styles.scaleBtn}>
              <MaterialCommunityIcons name="minus" size={20} color={colors.brand} />
            </Pressable>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.scaleValue, { color: colors.onSurface }]}>{scale} m ({Math.round(scale * 3.28084)} ft)</Text>
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
                  <Text style={[styles.summaryNum, { color: colors.onSurface }]}>{fmtLen(est.wallLen)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Wall length</Text>
                </View>
                <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.summaryNum, { color: colors.onSurface }]}>{fmtArea(est.floorArea)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>Floor area</Text>
                </View>
              </View>

              <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Materials &amp; live Bazaar prices</Text>
              {materialCard("format-paint", "Paint", `${est.paintLitres} L · ${est.paintCans} cans`, `2 coats over ${est.paintArea} m²`, costs?.paint ?? 0)}
              {materialCard("wall", "Timber / Wood", `${est.woodBoards} boards`, `${est.woodLinear} m of framing (2.4 m boards)`, costs?.wood ?? 0)}
              {materialCard("view-grid", "Flooring", `${est.flooringM2} m²`, `≈ ${est.flooringBoxes} boxes`, costs?.floor ?? 0)}

              <View style={[styles.totalRow, { borderColor: colors.brand }]}>
                <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Estimated materials total</Text>
                <Text style={[styles.totalValue, { color: colors.brand }]}>{formatPrice(costs?.total ?? 0)}</Text>
              </View>

              {addedMsg ? <Text style={[styles.added, { color: colors.brand }]}>{addedMsg}</Text> : null}
              <ForgeButton label="Add all to Bazaar cart" fullWidth size="lg" loading={adding} onPress={purchase} testID="estimator-purchase" style={{ marginTop: spacing.md }} />
              <Pressable testID="estimator-cost" onPress={() => router.push("/bluepaint/cost")} style={styles.linkBtn}>
                <MaterialCommunityIcons name="calculator-variant" size={16} color={colors.brand} />
                <Text style={[styles.linkText, { color: colors.brand }]}>Full project budget (labour + permits) →</Text>
              </Pressable>
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
  scaleValue: { fontFamily: fonts.display, fontSize: 18 },
  scaleHint: { fontFamily: fonts.body, fontSize: 11 },
  warn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  summary: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingVertical: spacing.md, gap: 2 },
  summaryNum: { fontFamily: fonts.displaySemi, fontSize: 14, textAlign: "center" },
  summaryLabel: { fontFamily: fonts.body, fontSize: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  cardIcon: { width: 46, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  cardPrimary: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 1 },
  cardSecondary: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  cardCost: { fontFamily: fonts.displaySemi, fontSize: 15 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.sm },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  totalValue: { fontFamily: fonts.display, fontSize: 20 },
  added: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  linkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  disclaimer: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
});
