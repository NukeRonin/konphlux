import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBQuiz } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function QuizRunner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [quiz, setQuiz] = useState<BBQuiz | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; total: number; correct: number[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const res = await api.bbQuiz(id);
      setQuiz(res);
      setAnswers(new Array(res.questions.length).fill(-1));
      setResult(null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (qi: number, oi: number) => {
    if (result) return;
    setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)));
  };

  const submit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      setResult(await api.bbQuizSubmit(id, answers));
    } catch {
      // noop
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = answers.length > 0 && answers.every((a) => a >= 0);

  const optionColor = (qi: number, oi: number) => {
    if (!result) return answers[qi] === oi ? colors.brand : colors.border;
    if (result.correct[qi] === oi) return colors.success;
    if (answers[qi] === oi && answers[qi] !== result.correct[qi]) return colors.error;
    return colors.border;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} onPress={() => router.back()} testID="quiz-back" />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{quiz?.title ?? "Quiz"}</Text>
          <Eyebrow>{quiz?.category ?? "Loading"}</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Loading questions…" />
      ) : status === "error" || !quiz ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {result ? (
            <View style={[styles.scoreCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
              <MaterialCommunityIcons name="trophy" size={30} color={colors.brand} />
              <Text style={[styles.scoreNum, { color: colors.onSurface }]}>{result.score} / {result.total}</Text>
              <Text style={[styles.scoreLabel, { color: colors.muted }]}>
                {result.score === result.total ? "Flawless! Brianna is impressed." : result.score >= result.total / 2 ? "Well done — review the reds." : "Keep at it — the correct answers are marked green."}
              </Text>
            </View>
          ) : null}

          {quiz.questions.map((q, qi) => (
            <View key={qi} style={styles.qBlock}>
              <Text style={[styles.qText, { color: colors.onSurface }]}>{qi + 1}. {q.q}</Text>
              {q.options.map((opt, oi) => (
                <Text
                  key={oi}
                  testID={`q${qi}-opt${oi}`}
                  onPress={() => pick(qi, oi)}
                  style={[
                    styles.option,
                    {
                      color: colors.onSurface,
                      borderColor: optionColor(qi, oi),
                      backgroundColor: answers[qi] === oi && !result ? colors.surfaceTertiary : colors.surfaceSecondary,
                    },
                  ]}
                >
                  {opt}
                </Text>
              ))}
            </View>
          ))}

          {result ? (
            <ForgeButton label="Try again" fullWidth onPress={load} testID="quiz-retry" style={{ marginTop: spacing.md }} />
          ) : (
            <ForgeButton label="Submit answers" fullWidth loading={submitting} disabled={!allAnswered} onPress={submit} testID="quiz-submit" style={{ marginTop: spacing.md }} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  scoreCard: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.lg, alignItems: "center", gap: 4, marginBottom: spacing.lg },
  scoreNum: { fontFamily: fonts.display, fontSize: 28 },
  scoreLabel: { fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
  qBlock: { marginBottom: spacing.lg, gap: spacing.sm },
  qText: { fontFamily: fonts.displaySemi, fontSize: 16, marginBottom: 4 },
  option: { fontFamily: fonts.bodyMedium, fontSize: 14, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, overflow: "hidden" },
});
