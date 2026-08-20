import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBCourse } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<BBCourse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [open, setOpen] = useState<number | null>(0);
  const [completed, setCompleted] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const res = await api.bbCourse(id);
      setCourse(res);
      setCompleted(res.completed);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleComplete = async (index: number) => {
    if (!id) return;
    const isDone = completed.includes(index);
    // optimistic
    setCompleted((c) => (isDone ? c.filter((i) => i !== index) : [...c, index]));
    try {
      const res = await api.bbProgress(id, index, !isDone);
      setCompleted(res.completed);
    } catch {
      setCompleted((c) => (isDone ? [...c, index] : c.filter((i) => i !== index)));
    }
  };

  const total = course?.lessons.length ?? 0;
  const pct = total ? Math.round((completed.length / total) * 100) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="coursedetail-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{course?.title ?? "Course"}</Text>
          <Eyebrow>{course ? `${course.category} · ${course.level}` : "Loading"}</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Opening the ledger…" />
      ) : status === "error" || !course ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name={course.icon as IconName} size={28} color={colors.brand} />
            </View>
            <Text style={[styles.summary, { color: colors.onSurface }]}>{course.summary}</Text>
            {/* Progress */}
            <View style={styles.progRow}>
              <Text style={[styles.progLabel, { color: colors.muted }]}>{completed.length}/{total} complete</Text>
              <Text style={[styles.progLabel, { color: colors.brand }]}>{pct}%</Text>
            </View>
            <View style={[styles.progTrack, { backgroundColor: colors.surfaceTertiary }]}>
              <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: colors.brand }]} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Lessons</Text>
          {course.lessons.map((lesson, i) => {
            const done = completed.includes(i);
            const expanded = open === i;
            return (
              <View key={i} style={[styles.lesson, { backgroundColor: colors.surfaceSecondary, borderColor: done ? colors.brand : colors.border }]}>
                <Pressable testID={`lesson-${i}`} onPress={() => setOpen(expanded ? null : i)} style={styles.lessonHead}>
                  <Pressable testID={`lesson-check-${i}`} onPress={() => toggleComplete(i)} hitSlop={10} style={[styles.check, { borderColor: done ? colors.brand : colors.borderStrong, backgroundColor: done ? colors.brand : "transparent" }]}>
                    {done ? <MaterialCommunityIcons name="check" size={16} color={colors.onBrandPrimary} /> : null}
                  </Pressable>
                  <Text style={[styles.lessonTitle, { color: colors.onSurface }]}>{i + 1}. {lesson.title}</Text>
                  <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </Pressable>
                {expanded ? (
                  <View style={styles.lessonBody}>
                    <Text style={[styles.lessonText, { color: colors.muted }]}>{lesson.body}</Text>
                    <Pressable testID={`lesson-done-${i}`} onPress={() => toggleComplete(i)} style={[styles.doneBtn, { borderColor: colors.brand, backgroundColor: done ? colors.surfaceTertiary : "transparent" }]}>
                      <MaterialCommunityIcons name={done ? "check-circle" : "circle-outline"} size={16} color={colors.brand} />
                      <Text style={[styles.doneText, { color: colors.brand }]}>{done ? "Completed" : "Mark as complete"}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  hero: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  heroIcon: { width: 52, height: 52, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  summary: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  progRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  progLabel: { fontFamily: fonts.bodyBold, fontSize: 12 },
  progTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progFill: { height: 8, borderRadius: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  lesson: { borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  lessonHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  lessonTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 15 },
  lessonBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  lessonText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  doneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.sm, borderWidth: 1.5 },
  doneText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
