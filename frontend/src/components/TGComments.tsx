import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, TGComment } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Bubble({ c, colors, onReply, onDelete, onLike }: { c: TGComment; colors: any; onReply: (c: TGComment) => void; onDelete: (id: string) => void; onLike: (c: TGComment) => void }) {
  return (
    <View style={styles.bubble}>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={[styles.avatarText, { color: colors.brand }]}>{(c.author_name || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.metaRow}>
          <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{c.author_name}</Text>
          <Text style={[styles.time, { color: colors.muted }]}>· {timeAgo(c.created_at)}</Text>
        </View>
        <Text style={[styles.body, { color: colors.onSurface }]}>{c.body}</Text>
        <View style={styles.actionsRow}>
          <Pressable onPress={() => onLike(c)} hitSlop={8} style={styles.likeBtn} testID={`tg-comment-like-${c.id}`}>
            <MaterialCommunityIcons name={c.liked ? "heart" : "heart-outline"} size={15} color={c.liked ? colors.brand : colors.muted} />
            {c.likes > 0 ? <Text style={[styles.likeCount, { color: c.liked ? colors.brand : colors.muted }]}>{c.likes}</Text> : null}
          </Pressable>
          <Pressable onPress={() => onReply(c)} hitSlop={8} testID={`tg-reply-${c.id}`}>
            <Text style={[styles.action, { color: colors.brand }]}>Reply</Text>
          </Pressable>
          {c.is_mine ? (
            <Pressable onPress={() => onDelete(c.id)} hitSlop={8} testID={`tg-comment-delete-${c.id}`}>
              <Text style={[styles.action, { color: colors.muted }]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function TGComments({ articleId, onCountChange }: { articleId: string; onCountChange?: (n: number) => void }) {
  const { colors } = useTheme();
  const [comments, setComments] = useState<TGComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<TGComment | null>(null);

  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  const load = useCallback(async () => {
    try {
      const list = await api.tgComments(articleId);
      setComments(list);
      onCountChange?.(list.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [articleId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await api.tgAddComment(articleId, value, replyTo?.id);
      setText(""); setReplyTo(null);
      await load();
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const remove = (id: string) => {
    Alert.alert("Delete comment?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.tgDeleteComment(id); await load(); } catch { /* ignore */ } } },
    ]);
  };

  const like = async (target: TGComment) => {
    // optimistic toggle across top-level + replies
    const flip = (c: TGComment): TGComment => c.id === target.id
      ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) }
      : { ...c, replies: c.replies?.map(flip) };
    setComments((prev) => prev.map(flip));
    try { await api.tgLikeComment(target.id); } catch { load(); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.onSurface }]}>Responses{total ? ` · ${total}` : ""}</Text>

      <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
        {replyTo ? (
          <View style={styles.replyBanner}>
            <Text style={[styles.replyText, { color: colors.muted }]} numberOfLines={1}>Replying to {replyTo.author_name}</Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Share a thoughtful response…"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, { color: colors.onSurface }]}
          testID="tg-comment-input"
        />
        <View style={styles.composerFooter}>
          <Pressable
            onPress={submit}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}
            testID="tg-comment-send"
          >
            {sending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : (
              <Text style={[styles.sendText, { color: text.trim() ? colors.onBrandPrimary : colors.muted }]}>{replyTo ? "Reply" : "Post"}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.brand} />
      ) : comments.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>No responses yet. Be the first to write back.</Text>
      ) : (
        comments.map((c) => (
          <View key={c.id} style={[styles.thread, { borderTopColor: colors.border }]}>
            <Bubble c={c} colors={colors} onReply={setReplyTo} onDelete={remove} onLike={like} />
            {(c.replies || []).map((r) => (
              <View key={r.id} style={[styles.replyIndent, { borderLeftColor: colors.border }]}>
                <Bubble c={r} colors={colors} onReply={() => setReplyTo(c)} onDelete={remove} onLike={like} />
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: { fontFamily: fonts.displaySemi, fontSize: 19, marginBottom: spacing.md },
  composer: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  replyText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, flex: 1 },
  input: { fontFamily: fonts.body, fontSize: 15, minHeight: 44, lineHeight: 21, textAlignVertical: "top" },
  composerFooter: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.sm },
  sendBtn: { height: 36, minWidth: 76, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  sendText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  empty: { fontFamily: fonts.body, fontSize: 14, marginTop: spacing.lg, textAlign: "center" },
  thread: { borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.md },
  bubble: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, flexShrink: 1 },
  time: { fontFamily: fonts.body, fontSize: 12 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, marginTop: 2 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: 6 },
  action: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeCount: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  replyIndent: { marginLeft: spacing.lg, marginTop: spacing.md, paddingLeft: spacing.md, borderLeftWidth: 2 },
});
