import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BPDesign, BPDesignSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { computeEstimate, fmtArea, fmtLen, MATERIAL_IDS } from "@/src/utils/bpEstimate";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

const num = (s: string) => (isNaN(parseFloat(s)) ? 0 : parseFloat(s));

export default function CostEstimator() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<BPDesignSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [design, setDesign] = useState<BPDesign | null>(null);
  const [scale] = useState(8);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const [labourRate, setLabourRate] = useState("35");
  const [hours, setHours] = useState("");
  const [permits, setPermits] = useState("150");
  const [contingency, setContingency] = useState(10);
  const [busy, setBusy] = useState(false);

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
    try { setDesign(await api.bpDesign(id)); } catch { /* ignore */ }
  };

  const est = useMemo(() => (design ? computeEstimate(design.walls, scale) : null), [design, scale]);

  const suggestedHours = est ? Math.max(4, Math.round(est.floorArea * 2)) : 0;
  const effectiveHours = hours.trim() ? num(hours) : suggestedHours;

  const budget = useMemo(() => {
    if (!est) return null;
    const materials =
      (prices[MATERIAL_IDS.paint] ?? 0) * est.paintCans +
      (prices[MATERIAL_IDS.wood] ?? 0) * est.woodBoards +
      (prices[MATERIAL_IDS.floor] ?? 0) * est.flooringM2;
    const labour = Math.round(num(labourRate) * 100 * effectiveHours);
    const permit = Math.round(num(permits) * 100);
    const subtotal = materials + labour + permit;
    const contingencyC = Math.round((subtotal * contingency) / 100);
    return { materials, labour, permit, subtotal, contingencyC, total: subtotal + contingencyC };
  }, [est, prices, labourRate, effectiveHours, permits, contingency]);

  const summaryText = () => {
    if (!design || !est || !budget) return "";
    return [
      `KONPHLUX — PROJECT BUDGET`,
      `Design: ${design.name}`,
      `Plan width: ${scale} m`,
      ``,
      `MEASUREMENTS`,
      `Wall length: ${fmtLen(est.wallLen)}`,
      `Floor area: ${fmtArea(est.floorArea)}`,
      ``,
      `MATERIALS`,
      `Paint: ${est.paintCans} cans (${est.paintLitres} L) — ${formatPrice((prices[MATERIAL_IDS.paint] ?? 0) * est.paintCans)}`,
      `Timber/Wood: ${est.woodBoards} boards — ${formatPrice((prices[MATERIAL_IDS.wood] ?? 0) * est.woodBoards)}`,
      `Flooring: ${est.flooringM2} m² — ${formatPrice((prices[MATERIAL_IDS.floor] ?? 0) * est.flooringM2)}`,
      `Materials subtotal: ${formatPrice(budget.materials)}`,
      ``,
      `LABOUR & FEES`,
      `Labour: ${effectiveHours} hrs @ ${formatPrice(num(labourRate) * 100)}/hr — ${formatPrice(budget.labour)}`,
      `Permits: ${formatPrice(budget.permit)}`,
      `Contingency (${contingency}%): ${formatPrice(budget.contingencyC)}`,
      ``,
      `TOTAL PROJECT BUDGET: ${formatPrice(budget.total)}`,
    ].join("\n");
  };

  const exportText = async () => {
    try { await Share.share({ message: summaryText() }); } catch { /* cancelled */ }
  };

  const exportPdf = async () => {
    if (!design || !est || !budget) return;
    setBusy(true);
    try {
      const row = (a: string, b: string) => `<tr><td>${a}</td><td style="text-align:right">${b}</td></tr>`;
      const html = `<html><head><meta name="viewport" content="width=device-width"><style>
        body{font-family:-apple-system,Helvetica,Arial;padding:28px;color:#2b2118}
        h1{font-size:22px;margin:0 0 2px} .sub{color:#8a795f;margin:0 0 18px}
        h2{font-size:14px;letter-spacing:1px;color:#8a795f;margin:22px 0 6px;text-transform:uppercase}
        table{width:100%;border-collapse:collapse} td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
        .total{font-size:20px;font-weight:700;color:#b8860b}</style></head><body>
        <h1>${design.name}</h1><p class="sub">Konphlux — Project Budget</p>
        <h2>Measurements</h2><table>${row("Wall length", fmtLen(est.wallLen))}${row("Floor area", fmtArea(est.floorArea))}</table>
        <h2>Materials</h2><table>
        ${row(`Paint — ${est.paintCans} cans (${est.paintLitres} L)`, formatPrice((prices[MATERIAL_IDS.paint] ?? 0) * est.paintCans))}
        ${row(`Timber/Wood — ${est.woodBoards} boards`, formatPrice((prices[MATERIAL_IDS.wood] ?? 0) * est.woodBoards))}
        ${row(`Flooring — ${est.flooringM2} m²`, formatPrice((prices[MATERIAL_IDS.floor] ?? 0) * est.flooringM2))}
        ${row("<b>Materials subtotal</b>", `<b>${formatPrice(budget.materials)}</b>`)}</table>
        <h2>Labour &amp; Fees</h2><table>
        ${row(`Labour — ${effectiveHours} hrs @ ${formatPrice(num(labourRate) * 100)}/hr`, formatPrice(budget.labour))}
        ${row("Permits", formatPrice(budget.permit))}
        ${row(`Contingency (${contingency}%)`, formatPrice(budget.contingencyC))}</table>
        <h2>Total</h2><p class="total">${formatPrice(budget.total)}</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const field = (label: string, value: string, setter: (s: string) => void, prefix?: string, tid?: string) => (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.muted }]}>{prefix}</Text> : null}
        <TextInput testID={tid} value={value} onChangeText={setter} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={[styles.fieldInput, { color: colors.onSurface }]} />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="cost-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Cost Estimator</Text>
          <Eyebrow>Full project budget</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Adding up the ledger…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : designs.length === 0 ? (
        <EmptyState icon="floor-plan" title="No designs yet" subtitle="Create a design in Space Designer first." />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Design</Text>
          <View style={styles.chipRow}>
            {designs.map((d) => (
              <Pressable key={d.id} testID={`cost-design-${d.id}`} onPress={() => chooseDesign(d.id)} style={[styles.chip, { backgroundColor: selected === d.id ? colors.surfaceTertiary : "transparent", borderColor: selected === d.id ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: selected === d.id ? colors.brand : colors.muted }]}>{d.name}</Text>
              </Pressable>
            ))}
          </View>

          {est?.hasWalls ? (
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

              <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Local labour &amp; permits</Text>
              <View style={styles.fieldRow}>
                {field("Labour rate / hour", labourRate, setLabourRate, "$", "cost-labour-rate")}
                {field(`Hours (≈${suggestedHours})`, hours, setHours, "", "cost-hours")}
              </View>
              <View style={styles.fieldRow}>
                {field("Permit costs", permits, setPermits, "$", "cost-permits")}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Contingency</Text>
                  <View style={[styles.fieldBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, justifyContent: "space-between" }]}>
                    <Pressable testID="cost-cont-down" onPress={() => setContingency((c) => Math.max(0, c - 5))} hitSlop={8}><MaterialCommunityIcons name="minus" size={18} color={colors.brand} /></Pressable>
                    <Text style={[styles.fieldInput, { color: colors.onSurface, textAlign: "center" }]}>{contingency}%</Text>
                    <Pressable testID="cost-cont-up" onPress={() => setContingency((c) => Math.min(50, c + 5))} hitSlop={8}><MaterialCommunityIcons name="plus" size={18} color={colors.brand} /></Pressable>
                  </View>
                </View>
              </View>

              {/* Breakdown */}
              <View style={[styles.breakdown, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {[
                  ["Materials", budget?.materials ?? 0],
                  ["Labour", budget?.labour ?? 0],
                  ["Permits", budget?.permit ?? 0],
                  [`Contingency (${contingency}%)`, budget?.contingencyC ?? 0],
                ].map(([k, v]) => (
                  <View key={k as string} style={styles.brRow}>
                    <Text style={[styles.brLabel, { color: colors.muted }]}>{k}</Text>
                    <Text style={[styles.brValue, { color: colors.onSurface }]}>{formatPrice(v as number)}</Text>
                  </View>
                ))}
                <View style={[styles.brRow, styles.brTotal, { borderTopColor: colors.border }]}>
                  <Text style={[styles.brTotalLabel, { color: colors.onSurface }]}>Total budget</Text>
                  <Text style={[styles.brTotalValue, { color: colors.brand }]}>{formatPrice(budget?.total ?? 0)}</Text>
                </View>
              </View>

              <View style={styles.exportRow}>
                <Pressable testID="cost-export-pdf" onPress={exportPdf} disabled={busy} style={[styles.exportBtn, { backgroundColor: colors.brand }]}>
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color={colors.onBrandPrimary} />
                  <Text style={[styles.exportText, { color: colors.onBrandPrimary }]}>Export PDF</Text>
                </Pressable>
                <Pressable testID="cost-export-text" onPress={exportText} style={[styles.exportBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={colors.brand} />
                  <Text style={[styles.exportText, { color: colors.onSurface }]}>Share text</Text>
                </Pressable>
              </View>
              <ForgeButton label="Buy materials in Bazaar" fullWidth onPress={() => router.push("/bluepaint/estimator")} testID="cost-buy" style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <View style={[styles.warn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.muted} />
              <Text style={[styles.warnText, { color: colors.muted }]}>This design has no walls yet. Draw a floor plan in Space Designer first.</Text>
            </View>
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  summary: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingVertical: spacing.md, gap: 2 },
  summaryNum: { fontFamily: fonts.displaySemi, fontSize: 14, textAlign: "center" },
  summaryLabel: { fontFamily: fonts.body, fontSize: 12 },
  fieldRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 4 },
  fieldBox: { flexDirection: "row", alignItems: "center", gap: 4, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  prefix: { fontFamily: fonts.bodyBold, fontSize: 15 },
  fieldInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  breakdown: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  brRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  brLabel: { fontFamily: fonts.body, fontSize: 14 },
  brValue: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  brTotal: { borderTopWidth: 1, marginTop: spacing.xs, paddingTop: spacing.sm },
  brTotalLabel: { fontFamily: fonts.displaySemi, fontSize: 16 },
  brTotalValue: { fontFamily: fonts.display, fontSize: 20 },
  exportRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48, borderRadius: radius.md },
  exportText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  warn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
