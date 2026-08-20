import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBHub } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const QUICK: { label: string; icon: IconName; route: string }[] = [
  { label: "Courses", icon: "book-education", route: "/brainboost/courses" },
  { label: "Quizzes", icon: "help-circle", route: "/brainboost/quizzes" },
  { label: "Dictionary", icon: "book-alphabet", route: "/brainboost/lexicon?mode=dictionary" },
  { label: "Thesaurus", icon: "book-search", route: "/brainboost/lexicon?mode=thesaurus" },
  { label: "Fun Facts", icon: "lightbulb-on", route: "/brainboost/facts" },
  { label: "Videos", icon: "play-circle", route: "/brainboost/videos" },
  { label: "Repair Guy", icon: "wrench", route: "/brainboost/repair" },
  { label: "AI Tutor", icon: "school", route: "/chatmonger/brainboost" },
];

export default function BrainBoostHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<BBHub | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setData(await api.bbHub());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="bb-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>
            BrainBoost
          </Text>
          <Eyebrow>Learn a new trade before supper</Eyebrow>
        </View>
        <Pressable testID="bb-tutor-btn" onPress={() => router.push("/chatmonger/brainboost")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="school" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Lighting the lecture-lamps…" />
      ) : status === "error" || !data ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Fact of the Day */}
          <Pressable testID="bb-fact-card" onPress={() => router.push("/brainboost/facts")}>
            <LinearGradient colors={colors.brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.factCard, { borderColor: colors.brandSecondary }]}>
              <View style={styles.factTop}>
                <MaterialCommunityIcons name="lightbulb-on" size={18} color={colors.onBrandPrimary} />
                <Text style={[styles.factLabel, { color: colors.onBrandPrimary }]}>FACT OF THE DAY</Text>
              </View>
              <Text style={[styles.factText, { color: colors.onBrandPrimary }]}>{data.fact_of_day}</Text>
              <Text style={[styles.factMore, { color: colors.onBrandPrimary }]}>Tap for more facts →</Text>
            </LinearGradient>
          </Pressable>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { icon: "book-education" as IconName, n: data.course_count, l: "Courses" },
              { icon: "help-circle" as IconName, n: data.quiz_count, l: "Quizzes" },
              { icon: "progress-check" as IconName, n: data.lessons_completed, l: "Completed" },
            ].map((s) => (
              <View key={s.l} style={[styles.stat, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={s.icon} size={18} color={colors.brand} />
                <Text style={[styles.statNum, { color: colors.onSurface }]}>{s.n}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Quick actions */}
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>What shall we learn?</Text>
          <View style={styles.grid}>
            {QUICK.map((q) => (
              <Pressable key={q.label} testID={`bb-quick-${q.label}`} onPress={() => router.push(q.route as any)} style={[styles.gridItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={q.icon} size={24} color={colors.brand} />
                <Text style={[styles.gridText, { color: colors.onSurface }]}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Featured courses */}
          <View style={styles.featHead}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface, marginBottom: 0 }]}>Featured courses</Text>
            <Pressable testID="bb-see-all" onPress={() => router.push("/brainboost/courses")}>
              <Text style={[styles.seeAll, { color: colors.brand }]}>See all</Text>
            </Pressable>
          </View>
          <View style={{ gap: spacing.sm }}>
            {data.featured.map((c) => (
              <Pressable key={c.id} testID={`bb-course-${c.id}`} onPress={() => router.push(`/brainboost/course/${c.id}`)} style={[styles.courseRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.courseIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={c.icon as IconName} size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.courseTitle, { color: colors.onSurface }]}>{c.title}</Text>
                  <Text numberOfLines={1} style={[styles.courseMeta, { color: colors.muted }]}>{c.category} · {c.level} · {c.lesson_count} lessons</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  factCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  factTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  factLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  factText: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 24 },
  factMore: { fontFamily: fonts.bodyMedium, fontSize: 12, opacity: 0.9 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  stat: { flex: 1, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingVertical: spacing.md, gap: 2 },
  statNum: { fontFamily: fonts.display, fontSize: 20 },
  statLabel: { fontFamily: fonts.body, fontSize: 11 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: { width: "23.5%", aspectRatio: 0.92, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
  gridText: { fontFamily: fonts.bodyBold, fontSize: 10.5, textAlign: "center" },
  featHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  seeAll: { fontFamily: fonts.bodyBold, fontSize: 13 },
  courseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  courseIcon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  courseTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  courseMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
