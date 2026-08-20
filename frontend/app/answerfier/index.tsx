import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AnswerfierBoard, Question } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

type SortKey = "new" | "popular" | "trending" | "unanswered";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "popular", label: "Popular" },
  { key: "trending", label: "Trending" },
  { key: "unanswered", label: "Unanswered" },
];

function QuestionRow({ question }: { question: Question }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`question-${question.id}`}
      onPress={() => router.push(`/answerfier/question/${question.id}`)}
      style={({ pressed }) => [
        styles.qRow,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.qStat}>
        <Text style={[styles.qStatNum, { color: question.best_answer_id ? colors.brandSecondary : colors.onSurface }]}>
          {compactNumber(question.answer_count)}
        </Text>
        <Text style={[styles.qStatLabel, { color: colors.muted }]}>ans</Text>
        {question.best_answer_id ? (
          <MaterialCommunityIcons name="check-decagram" size={14} color={colors.brandSecondary} style={{ marginTop: 2 }} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.qTitle, { color: colors.onSurface }]}>{question.title}</Text>
        <View style={styles.qMeta}>
          <View style={[styles.catPill, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[styles.catText, { color: colors.brand }]}>{question.category}</Text>
          </View>
          <Text style={[styles.qMetaText, { color: colors.muted }]}>{question.author}</Text>
          <Text style={[styles.qMetaText, { color: colors.muted }]}>· {timeAgo(question.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AnswerfierHub() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const initialSort: SortKey =
    filter === "popular" || filter === "trending" || filter === "unanswered" ? filter : "new";
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<AnswerfierBoard | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setBoard(await api.afBoard());
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
    if (!board) return [];
    let list = board.questions;
    if (category) list = list.filter((q) => q.category === category);
    if (sort === "unanswered") return list.filter((q) => q.answer_count === 0);
    const copy = [...list];
    if (sort === "popular") copy.sort((a, b) => b.answer_count - a.answer_count);
    else if (sort === "trending") copy.sort((a, b) => b.total_upvotes - a.total_upvotes);
    return copy;
  }, [board, sort, category]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="answerfier-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Answerfier</Text>
          <Eyebrow>Ask anything · someone knows</Eyebrow>
        </View>
        <Pressable
          testID="ask-question-btn"
          onPress={() => router.push("/answerfier/new-question")}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="pencil-plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Consulting the warden…" />
      ) : status === "error" || !board ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(q) => q.id}
          renderItem={({ item }) => <QuestionRow question={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Question of the Day */}
              <Pressable
                testID="qotd-card"
                onPress={() => router.push(`/answerfier/question/${board.qotd.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, marginBottom: spacing.lg })}
              >
                <LinearGradient
                  colors={colors.brassGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.qotd, { borderColor: colors.brandSecondary }]}
                >
                  <View style={styles.qotdTop}>
                    <MaterialCommunityIcons name="calendar-star" size={16} color={colors.onBrandPrimary} />
                    <Text style={[styles.qotdEyebrow, { color: colors.onBrandPrimary }]}>QUESTION OF THE DAY</Text>
                  </View>
                  <Text style={[styles.qotdTitle, { color: colors.onBrandPrimary }]}>{board.qotd.title}</Text>
                  <View style={styles.qotdFoot}>
                    <MaterialCommunityIcons name="comment-multiple-outline" size={15} color={colors.onBrandPrimary} />
                    <Text style={[styles.qotdFootText, { color: colors.onBrandPrimary }]}>
                      {board.qotd.answer_count} {board.qotd.answer_count === 1 ? "answer" : "answers"} · tap to answer
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>

              {/* Sort chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {SORTS.map((s) => (
                  <Pressable
                    key={s.key}
                    testID={`sort-${s.key}`}
                    onPress={() => setSort(s.key)}
                    style={[styles.chip, { backgroundColor: sort === s.key ? colors.brand : colors.surfaceSecondary, borderColor: sort === s.key ? colors.brand : colors.border }]}
                  >
                    <Text style={[styles.chipText, { color: sort === s.key ? colors.onBrandPrimary : colors.onSurface }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Category chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginTop: spacing.xs }]}>
                <Pressable
                  testID="cat-all"
                  onPress={() => setCategory(null)}
                  style={[styles.catChip, { backgroundColor: !category ? colors.surfaceTertiary : "transparent", borderColor: !category ? colors.brand : colors.border }]}
                >
                  <Text style={[styles.catChipText, { color: !category ? colors.brand : colors.muted }]}>All topics</Text>
                </Pressable>
                {board.categories.map((c) => (
                  <Pressable
                    key={c}
                    testID={`cat-${c}`}
                    onPress={() => setCategory(category === c ? null : c)}
                    style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}
                  >
                    <Text style={[styles.catChipText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Eyebrow style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Questions</Eyebrow>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="help-circle-outline"
              title={sort === "unanswered" ? "No unanswered questions" : "No questions yet"}
              subtitle="Be the first to ask — tap the pencil above."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, flexGrow: 1 },
  qotd: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  qotdTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  qotdEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1 },
  qotdTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 28, marginTop: spacing.sm },
  qotdFoot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  qotdFootText: { fontFamily: fonts.bodyMedium, fontSize: 12, opacity: 0.9 },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  catChip: { height: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  catChipText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  qRow: {
    flexDirection: "row",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  qStat: { width: 44, alignItems: "center" },
  qStatNum: { fontFamily: fonts.bodyBold, fontSize: 18 },
  qStatLabel: { fontFamily: fonts.body, fontSize: 11 },
  qTitle: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 21 },
  qMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" },
  catPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  qMetaText: { fontFamily: fonts.body, fontSize: 12 },
});
