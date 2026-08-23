import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Reply, Thread } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

function MentionText({ body, names, colors }: { body: string; names?: string[]; colors: any }) {
  const list = (names ?? []).filter(Boolean);
  if (list.length === 0) return <Text style={[styles.replyBody, { color: colors.onSurface }]}>{body}</Text>;
  // Split on "@Name" tokens for the known participant names and highlight them.
  const escaped = list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  const parts = body.split(re);
  return (
    <Text style={[styles.replyBody, { color: colors.onSurface }]}>
      {parts.map((p, i) =>
        p.startsWith("@") && list.includes(p.slice(1)) ? (
          <Text key={i} style={{ color: colors.brand, fontFamily: fonts.bodyBold }}>{p}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

function ReplyItem({ reply }: { reply: Reply }) {
  const { colors } = useTheme();
  return (
    <View style={styles.reply}>
      <AvatarInitials name={reply.author} size={34} />
      <View style={[styles.replyBubble, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.replyHead}>
          <Text style={[styles.replyAuthor, { color: colors.onSurface }]}>{reply.author}</Text>
          <Text style={[styles.replyTime, { color: colors.muted }]}>{timeAgo(reply.created_at)}</Text>
        </View>
        <MentionText body={reply.body} names={reply.mention_names} colors={colors} />
      </View>
    </View>
  );
}

export default function ThreadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [thread, setThread] = useState<Thread | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.rtThread(id);
      setThread(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Unique people in this thread (author + repliers) who are real users, minus yourself.
  const participants = React.useMemo(() => {
    if (!thread) return [] as { id: string; name: string }[];
    const map = new Map<string, string>();
    const add = (uid?: string, name?: string) => {
      if (uid && name && uid !== "seed" && uid !== user?.id) map.set(uid, name);
    };
    add(thread.user_id, thread.author);
    (thread.replies ?? []).forEach((r) => add(r.user_id, r.author));
    return Array.from(map, ([uid, name]) => ({ id: uid, name }));
  }, [thread, user?.id]);

  const mention = (name: string) => {
    setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${name} `);
  };

  const vote = async () => {
    if (!thread) return;
    setThread({ ...thread, voted: !thread.voted, upvotes: thread.upvotes + (thread.voted ? -1 : 1) });
    try {
      await api.rtVote(thread.id);
    } catch {
      load();
    }
  };

  const submitReply = async () => {
    const body = text.trim();
    if (!body || sending || !thread) return;
    // Figure out which participants were actually @mentioned in the text.
    const mentionIds = participants.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
    setText("");
    setSending(true);
    try {
      const reply = await api.rtReply(thread.id, body, mentionIds);
      setThread((prev) =>
        prev ? { ...prev, replies: [...(prev.replies ?? []), reply], reply_count: prev.reply_count + 1 } : prev,
      );
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="thread-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>
          {thread?.community_name ?? "Thread"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {status === "loading" ? (
        <Loading label="Fetching the discussion…" />
      ) : status === "error" || !thread ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <FlatList
            data={thread.replies ?? []}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => <ReplyItem reply={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <Panel style={{ marginBottom: spacing.lg }}>
                  <Eyebrow>{thread.community_name}</Eyebrow>
                  <Text style={[styles.title, { color: colors.onSurface }]}>{thread.title}</Text>
                  <View style={styles.authorRow}>
                    <AvatarInitials name={thread.author} size={32} />
                    <Text style={[styles.author, { color: colors.muted }]}>
                      {thread.author} · {timeAgo(thread.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.body, { color: colors.onSurface }]}>{thread.body}</Text>
                  <Hairline style={{ marginVertical: spacing.md }} />
                  <View style={styles.actions}>
                    <Pressable onPress={vote} testID="thread-vote" style={[styles.votePill, { backgroundColor: thread.voted ? colors.brandSecondary : colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons
                        name={thread.voted ? "arrow-up-bold" : "arrow-up-bold-outline"}
                        size={18}
                        color={thread.voted ? colors.onBrandPrimary : colors.onSurface}
                      />
                      <Text style={[styles.votePillText, { color: thread.voted ? colors.onBrandPrimary : colors.onSurface }]}>
                        {compactNumber(thread.upvotes)}
                      </Text>
                    </Pressable>
                    <View style={styles.commentCount}>
                      <MaterialCommunityIcons name="comment-outline" size={18} color={colors.muted} />
                      <Text style={[styles.commentText, { color: colors.muted }]}>{thread.reply_count} replies</Text>
                    </View>
                  </View>
                </Panel>
                <Eyebrow style={{ marginBottom: spacing.sm }}>Replies</Eyebrow>
                {(thread.replies ?? []).length === 0 ? (
                  <Text style={[styles.empty, { color: colors.muted }]}>No replies yet — say the first word.</Text>
                ) : null}
              </View>
            }
          />

          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            {participants.length > 0 ? (
              <View style={[styles.mentionBar, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]}>
                <MaterialCommunityIcons name="at" size={16} color={colors.muted} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentionRow}>
                  {participants.map((p) => (
                    <Pressable key={p.id} testID={`mention-${p.id}`} onPress={() => mention(p.name)} style={[styles.mentionChip, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                      <Text style={[styles.mentionText, { color: colors.brand }]}>{p.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
              <TextInput
                testID="reply-input"
                value={text}
                onChangeText={setText}
                placeholder="Add your reply…"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
                multiline
              />
              <Pressable
                onPress={submitReply}
                disabled={!text.trim() || sending}
                testID="reply-send"
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
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, marginTop: 4 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  author: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  votePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  votePillText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  commentCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  empty: { fontFamily: fonts.body, fontSize: 14, fontStyle: "italic" },
  reply: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  replyBubble: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  replyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  replyAuthor: { fontFamily: fonts.displaySemi, fontSize: 14 },
  replyTime: { fontFamily: fonts.body, fontSize: 11 },
  replyBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: 4 },
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
  mentionBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1 },
  mentionRow: { gap: spacing.sm, paddingRight: spacing.lg },
  mentionChip: { height: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mentionText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
});
