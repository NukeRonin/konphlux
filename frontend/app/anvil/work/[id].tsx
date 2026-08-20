import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AnvilWork } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

export default function WorkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [work, setWork] = useState<AnvilWork | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setWork(await api.anvilWork(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const applaud = async () => {
    if (!work) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setWork({ ...work, applauded: !work.applauded, applause: work.applause + (work.applauded ? -1 : 1) });
    try {
      await api.anvilApplause(work.id);
    } catch {
      load();
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending || !work) return;
    setText("");
    setSending(true);
    try {
      const c = await api.anvilContribute(work.id, body);
      setWork((prev) => (prev ? { ...prev, contributions: [...(prev.contributions ?? []), c], contribution_count: prev.contribution_count + 1 } : prev));
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="work-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{work?.kind === "script" ? "Script" : "Story"}</Text>
        <View style={{ width: 26 }} />
      </View>

      {status === "loading" ? (
        <Loading label="Turning the page…" />
      ) : status === "error" || !work ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.tagRow}>
              <View style={[styles.pill, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.pillText, { color: colors.brand }]}>{work.category}</Text>
              </View>
              {work.open_cowriting ? (
                <View style={[styles.pill, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name="account-multiple" size={12} color={colors.aether} />
                  <Text style={[styles.pillText, { color: colors.aether }]}>Open for co-writing</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>{work.title}</Text>
            <Text style={[styles.byline, { color: colors.muted }]}>by {work.author} · {timeAgo(work.created_at)}</Text>

            <Text style={[styles.prose, { color: colors.onSurface }]}>{work.body}</Text>

            {(work.contributions ?? []).length > 0 ? (
              <>
                <Hairline style={{ marginVertical: spacing.lg }} />
                <Eyebrow style={{ marginBottom: spacing.sm }}>Co-written passages</Eyebrow>
                {work.contributions!.map((c) => (
                  <Panel key={c.id} style={{ marginBottom: spacing.md }}>
                    <View style={styles.cHead}>
                      <AvatarInitials name={c.author} size={26} />
                      <Text style={[styles.cAuthor, { color: colors.onSurface }]}>{c.author}</Text>
                      <Text style={[styles.cTime, { color: colors.muted }]}>· {timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={[styles.prose, { color: colors.onSurface, marginTop: spacing.sm }]}>{c.body}</Text>
                  </Panel>
                ))}
              </>
            ) : null}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Applause + co-writing composer */}
          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <View style={[styles.bar, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
              <Pressable testID="applaud-btn" onPress={applaud} style={[styles.applaud, { backgroundColor: work.applauded ? colors.brandSecondary : colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name="hand-clap" size={18} color={work.applauded ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.applaudText, { color: work.applauded ? colors.onBrandPrimary : colors.onSurface }]}>{compactNumber(work.applause)}</Text>
              </Pressable>
              {work.open_cowriting ? (
                <>
                  <TextInput
                    testID="contribute-input"
                    value={text}
                    onChangeText={setText}
                    placeholder="Add the next passage…"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
                    multiline
                  />
                  <Pressable testID="contribute-send" onPress={submit} disabled={!text.trim() || sending} style={[styles.send, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="send" size={18} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.closedNote, { color: colors.muted }]}>Applaud this {work.kind}</Text>
              )}
            </View>
          </KeyboardStickyView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 16 },
  body: { padding: spacing.lg },
  tagRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 33, marginTop: spacing.sm },
  byline: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  prose: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  cHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cAuthor: { fontFamily: fonts.displaySemi, fontSize: 13 },
  cTime: { fontFamily: fonts.body, fontSize: 12 },
  bar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  applaud: { flexDirection: "row", alignItems: "center", gap: 5, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  applaudText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  closedNote: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: "right" },
});
