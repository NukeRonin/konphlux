import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["Trades & Crafts", "Languages", "Science & Nature", "Arts & Music", "Home & Cooking", "Business & Money", "Technology", "Wellness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function NewCourse() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [summary, setSummary] = useState("");
  const [lessons, setLessons] = useState<{ title: string; body: string }[]>([{ title: "", body: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setLesson = (i: number, k: "title" | "body", v: string) => setLessons((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLesson = () => setLessons((p) => [...p, { title: "", body: "" }]);
  const removeLesson = (i: number) => setLessons((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const valid = title.trim().length >= 2 && lessons.some((l) => l.title.trim() && l.body.trim());

  const create = async () => {
    if (!valid || saving) return;
    setSaving(true); setError("");
    try {
      const clean = lessons.filter((l) => l.title.trim() && l.body.trim());
      const res = await api.bbCreateCourse({ title: title.trim(), category, level, summary: summary.trim(), lessons: clean });
      router.replace(`/brainboost/course/${res.id}`);
    } catch {
      setError("Couldn't publish the course. Please try again.");
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="nc-back"><MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Upload a Course</Text>
          <Eyebrow>Share what you know</Eyebrow>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 40}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.onSurface }]}>Course title</Text>
          <TextInput testID="nc-title" value={title} onChangeText={setTitle} placeholder="e.g. Beginner Watercolour" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, { backgroundColor: category === c ? colors.brand : colors.surfaceSecondary, borderColor: category === c ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: category === c ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Level</Text>
          <View style={styles.chips}>
            {LEVELS.map((l) => (
              <Pressable key={l} onPress={() => setLevel(l)} style={[styles.chip, { backgroundColor: level === l ? colors.brand : colors.surfaceSecondary, borderColor: level === l ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: level === l ? colors.onBrandPrimary : colors.onSurface }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Short summary</Text>
          <TextInput testID="nc-summary" value={summary} onChangeText={setSummary} placeholder="One line about what learners will get" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Lessons</Text>
          {lessons.map((l, i) => (
            <View key={i} style={[styles.lessonCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.lessonHead}>
                <Text style={[styles.lessonNum, { color: colors.brand }]}>Lesson {i + 1}</Text>
                {lessons.length > 1 ? <Pressable onPress={() => removeLesson(i)} hitSlop={8} testID={`nc-remove-${i}`}><MaterialCommunityIcons name="close" size={18} color={colors.muted} /></Pressable> : null}
              </View>
              <TextInput testID={`nc-lesson-title-${i}`} value={l.title} onChangeText={(v) => setLesson(i, "title", v)} placeholder="Lesson title" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface, marginBottom: spacing.sm }]} />
              <TextInput testID={`nc-lesson-body-${i}`} value={l.body} onChangeText={(v) => setLesson(i, "body", v)} placeholder="Lesson content…" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} />
            </View>
          ))}
          <Pressable onPress={addLesson} testID="nc-add-lesson" style={[styles.addLesson, { borderColor: colors.brand }]}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
            <Text style={[styles.addLessonText, { color: colors.brand }]}>Add lesson</Text>
          </Pressable>

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <ForgeButton label="Publish course" fullWidth size="lg" loading={saving} disabled={!valid} onPress={create} testID="nc-publish" style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  lessonCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  lessonHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  lessonNum: { fontFamily: fonts.bodyBold, fontSize: 13 },
  addLesson: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed" },
  addLessonText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  error: { fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md },
});
