import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function Facts() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ fact_of_day: string; date: string; more: string[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setData(await api.bbFacts());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} onPress={() => router.back()} testID="facts-back" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Fun Facts</Text>
          <Eyebrow>A new one every day</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Dusting off curiosities…" />
      ) : status === "error" || !data ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={colors.brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.factCard, { borderColor: colors.brandSecondary }]}>
            <View style={styles.factTop}>
              <MaterialCommunityIcons name="lightbulb-on" size={18} color={colors.onBrandPrimary} />
              <Text style={[styles.factLabel, { color: colors.onBrandPrimary }]}>FACT OF THE DAY</Text>
            </View>
            <Text style={[styles.factText, { color: colors.onBrandPrimary }]}>{data.fact_of_day}</Text>
          </LinearGradient>

          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>More curiosities</Text>
          {data.more.map((f, i) => (
            <View key={i} style={[styles.factRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="cog" size={16} color={colors.brandPrimary} style={{ marginTop: 2 }} />
              <Text style={[styles.factRowText, { color: colors.onSurface }]}>{f}</Text>
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
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  factCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  factTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  factLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  factText: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 26 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  factRow: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  factRowText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
