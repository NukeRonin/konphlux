import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Answer, Question } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

export default function QuestionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState<Question | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setQuestion(await api.afQuestion(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setAnswers = (fn: (a: Answer[]) => Answer[]) =>
    setQuestion((prev) => (prev ? { ...prev, answers: fn(prev.answers ?? []) } : prev));

  const vote = async (a: Answer) => {
    setAnswers((list) =>
      list.map((x) => (x.id === a.id ? { ...x, voted: !x.voted, upvotes: x.upvotes + (x.voted ? -1 : 1) } : x)),
    );
    try {
      await api.afVoteAnswer(a.id);
    } catch {
      load();
    }
  };

  const markBest = async (a: Answer) => {
    if (!question) return;
    const newBest = question.best_answer_id === a.id ? null : a.id;
    setQuestion({
      ...question,
      best_answer_id: newBest,
      answers: (question.answers ?? []).map((x) => ({ ...x, is_best: x.id === newBest })),
    });
    try {
      await api.afSetBest(question.id, a.id);
      load();
    } catch {
      load();
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending || !question) return;
    setText("");
    setSending(true);
    try {
      const ans = await api.afAddAnswer(question.id, body);
      setQuestion((prev) =>
        prev ? { ...prev, answers: [...(prev.answers ?? []), ans], answer_count: prev.answer_count + 1 } : prev,
      );
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const renderAnswer = ({ item }: { item: Answer }) => (
    <Panel
      style={
        item.is_best
          ? [styles.answer, { borderColor: colors.brandSecondary, borderWidth: 1.5 }]
          : styles.answer
      }
    >
      {item.is_best ? (
        <View style={styles.bestTag}>
          <MaterialCommunityIcons name="check-decagram" size={14} color={colors.brandSecondary} />
          <Text style={[styles.bestTagText, { color: colors.brandSecondary }]}>Best answer</Text>
        </View>
      ) : null}
      <View style={styles.answerHead}>
        <AvatarInitials name={item.author} size={30} />
        <Text style={[styles.answerAuthor, { color: colors.onSurface }]}>{item.author}</Text>
        <Text style={[styles.answerTime, { color: colors.muted }]}>· {timeAgo(item.created_at)}</Text>
      </View>
      <Text style={[styles.answerBody, { color: colors.onSurface }]}>{item.body}</Text>
      <View style={styles.answerActions}>
        <Pressable
          onPress={() => vote(item)}
          testID={`answer-vote-${item.id}`}
          style={[styles.votePill, { backgroundColor: item.voted ? colors.brandSecondary : colors.surfaceTertiary }]}
        >
          <MaterialCommunityIcons
            name={item.voted ? "arrow-up-bold" : "arrow-up-bold-outline"}
            size={16}
            color={item.voted ? colors.onBrandPrimary : colors.onSurface}
          />
          <Text style={[styles.votePillText, { color: item.voted ? colors.onBrandPrimary : colors.onSurface }]}>
            {compactNumber(item.upvotes)}
          </Text>
        </Pressable>
        {question?.is_author ? (
          <Pressable
            onPress={() => markBest(item)}
            testID={`answer-best-${item.id}`}
            style={[styles.bestBtn, { borderColor: item.is_best ? colors.brandSecondary : colors.border }]}
          >
            <MaterialCommunityIcons
              name={item.is_best ? "check-decagram" : "check-decagram-outline"}
              size={16}
              color={item.is_best ? colors.brandSecondary : colors.muted}
            />
            <Text style={[styles.bestBtnText, { color: item.is_best ? colors.brandSecondary : colors.muted }]}>
              {item.is_best ? "Best" : "Mark best"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Panel>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="question-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>
          {question?.is_qotd ? "Question of the Day" : "Question"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {status === "loading" ? (
        <Loading label="Fetching the question…" />
      ) : status === "error" || !question ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <FlatList
            data={question.answers ?? []}
            keyExtractor={(a) => a.id}
            renderItem={renderAnswer}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <Panel style={{ marginBottom: spacing.lg }}>
                  <View style={styles.catRow}>
                    <View style={[styles.catPill, { backgroundColor: colors.surfaceTertiary }]}>
                      <Text style={[styles.catText, { color: colors.brand }]}>{question.category}</Text>
                    </View>
                  </View>
                  <Text style={[styles.title, { color: colors.onSurface }]}>{question.title}</Text>
                  {question.body ? <Text style={[styles.body, { color: colors.muted }]}>{question.body}</Text> : null}
                  <Hairline style={{ marginVertical: spacing.md }} />
                  <Text style={[styles.askedBy, { color: colors.muted }]}>
                    Asked by {question.author} · {timeAgo(question.created_at)}
                  </Text>
                </Panel>
                <Eyebrow style={{ marginBottom: spacing.sm }}>
                  {question.answer_count} {question.answer_count === 1 ? "Answer" : "Answers"}
                </Eyebrow>
                {(question.answers ?? []).length === 0 ? (
                  <Text style={[styles.empty, { color: colors.muted }]}>No answers yet — be the first to reply.</Text>
                ) : null}
              </View>
            }
          />

          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
              <TextInput
                testID="answer-input"
                value={text}
                onChangeText={setText}
                placeholder="Write your answer…"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
                multiline
              />
              <Pressable
                onPress={submit}
                disabled={!text.trim() || sending}
                testID="answer-send"
                style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}
              >
                <MaterialCommunityIcons name="send" size={20} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          </KeyboardStickyView>
        </>
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
  headerTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 16 },
  list: { padding: spacing.lg, paddingBottom: spacing.lg },
  catRow: { flexDirection: "row" },
  catPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, marginTop: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  askedBy: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  empty: { fontFamily: fonts.body, fontSize: 14, fontStyle: "italic" },
  answer: { marginBottom: spacing.md },
  bestTag: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  bestTagText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  answerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  answerAuthor: { fontFamily: fonts.displaySemi, fontSize: 14 },
  answerTime: { fontFamily: fonts.body, fontSize: 12 },
  answerBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  answerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  votePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill },
  votePillText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  bestBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  bestBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
