import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBCourseCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function BrainBoostCourses() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const [data, setData] = useState<{ courses: BBCourseCard[]; categories: string[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setData(await api.bbCourses());
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

  const visible = useMemo(() => {
    if (!data) return [];
    return category ? data.courses.filter((c) => c.category === category) : data.courses;
  }, [data, category]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="courses-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Courses</Text>
          <Eyebrow>Ten minutes a day</Eyebrow>
        </View>
        <Pressable onPress={() => router.push("/brainboost/new-course")} hitSlop={10} testID="upload-course-btn" style={[styles.uploadBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
          <Text style={[styles.uploadText, { color: colors.brand }]}>Upload</Text>
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <Pressable testID="cat-all" onPress={() => setCategory(null)} style={[styles.catChip, { backgroundColor: !category ? colors.surfaceTertiary : "transparent", borderColor: !category ? colors.brand : colors.border }]}>
              <Text style={[styles.catText, { color: !category ? colors.brand : colors.muted }]}>All</Text>
            </Pressable>
            {(data?.categories ?? []).map((c) => (
              <Pressable key={c} testID={`cat-${c}`} onPress={() => setCategory(category === c ? null : c)} style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}>
                <Text style={[styles.catText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <Pressable testID={`course-${item.id}`} onPress={() => router.push(`/brainboost/course/${item.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name={item.icon as IconName} size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={2} style={[styles.summary, { color: colors.muted }]}>{item.summary}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.pill, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.pillText, { color: colors.brand }]}>{item.category}</Text>
                </View>
                <Text style={[styles.metaText, { color: colors.muted }]}>{item.level} · {item.lesson_count} lessons</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching the syllabus…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="book-education" title="No courses here yet" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  uploadText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  catRow: { gap: spacing.sm, paddingBottom: spacing.md },
  catChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  row: { flexDirection: "row", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 16 },
  summary: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  metaText: { fontFamily: fonts.body, fontSize: 11 },
});
