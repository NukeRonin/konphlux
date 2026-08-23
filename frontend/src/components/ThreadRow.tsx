import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api, Thread } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

/** A Roundtable thread summary row with an upvote pill. */
export function ThreadRow({
  thread,
  onVoted,
  showCommunity = true,
}: {
  thread: Thread;
  onVoted?: (t: Thread) => void;
  showCommunity?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const vote = async () => {
    onVoted?.({ ...thread, voted: !thread.voted, upvotes: thread.upvotes + (thread.voted ? -1 : 1) });
    try {
      await api.rtVote(thread.id);
    } catch {
      onVoted?.(thread);
    }
  };

  return (
    <Pressable testID={`thread-${thread.id}`} onPress={() => router.push(`/roundtable/thread/${thread.id}`)}>
      <Panel style={styles.card}>
        <View style={styles.voteCol}>
          <Pressable onPress={vote} hitSlop={8} testID={`vote-${thread.id}`} style={styles.voteBtn}>
            <MaterialCommunityIcons
              name={thread.voted ? "arrow-up-bold" : "arrow-up-bold-outline"}
              size={22}
              color={thread.voted ? colors.brandSecondary : colors.muted}
            />
            <Text style={[styles.voteCount, { color: thread.voted ? colors.brandSecondary : colors.onSurface }]}>
              {compactNumber(thread.upvotes)}
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {showCommunity ? <Eyebrow>{thread.community_name}</Eyebrow> : null}
          {thread.category ? (
            <View style={[styles.tag, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="tag-outline" size={11} color={colors.brand} />
              <Text style={[styles.tagText, { color: colors.brand }]}>{thread.category}</Text>
            </View>
          ) : null}
          <Text style={[styles.title, { color: colors.onSurface }]}>{thread.title}</Text>
          <Text numberOfLines={2} style={[styles.body, { color: colors.muted }]}>
            {thread.body}
          </Text>
          <View style={styles.meta}>
            <MaterialCommunityIcons name="account-circle-outline" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{thread.author}</Text>
            <Text style={[styles.metaDot, { color: colors.muted }]}>·</Text>
            <Text style={[styles.metaText, { color: colors.muted }]}>{timeAgo(thread.created_at)}</Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name="comment-outline" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{thread.reply_count}</Text>
          </View>
        </View>
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  voteCol: { alignItems: "center" },
  voteBtn: { alignItems: "center", gap: 2, width: 40 },
  voteCount: { fontFamily: fonts.bodyBold, fontSize: 13 },
  title: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 21, marginTop: 2 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
  metaText: { fontFamily: fonts.body, fontSize: 12 },
  metaDot: { fontFamily: fonts.body, fontSize: 12 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.3 },
  _r: { borderRadius: radius.md },
});
