import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, FeedResponse, Post } from "@/src/api/client";
import { AppHeader } from "@/src/components/AppHeader";
import { AvatarInitials, RingAvatar } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

function PostCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <Panel style={styles.postCard} testID={`post-${post.id}`}>
      <View style={styles.postHead}>
        <AvatarInitials name={post.author} size={44} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.author, { color: colors.onSurface }]}>
            {post.author}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {post.kind} · {post.time}
          </Text>
        </View>
        <View style={[styles.kindTag, { borderColor: colors.border, backgroundColor: colors.surfaceTertiary }]}>
          <Text style={[styles.kindText, { color: colors.muted }]}>{post.kind}</Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.onSurface }]}>{post.body}</Text>

      <Hairline style={{ marginVertical: spacing.md }} />

      <View style={styles.actions}>
        <Pressable
          onPress={() => onLike(post.id)}
          hitSlop={8}
          testID={`like-${post.id}`}
          style={styles.actionBtn}
        >
          <MaterialCommunityIcons
            name={post.liked ? "heart" : "heart-outline"}
            size={19}
            color={post.liked ? colors.brandSecondary : colors.muted}
          />
          <Text style={[styles.actionText, { color: post.liked ? colors.brandSecondary : colors.muted }]}>
            {compactNumber(post.likes)}
          </Text>
        </Pressable>
        <View style={styles.actionBtn}>
          <MaterialCommunityIcons name="comment-outline" size={18} color={colors.muted} />
          <Text style={[styles.actionText, { color: colors.muted }]}>{compactNumber(post.comments)}</Text>
        </View>
        <View style={styles.actionBtn}>
          <MaterialCommunityIcons name="share-variant" size={18} color={colors.muted} />
          <Text style={[styles.actionText, { color: colors.muted }]}>Share</Text>
        </View>
        <View style={{ flex: 1 }} />
        <MaterialCommunityIcons name="bookmark-outline" size={19} color={colors.muted} />
      </View>
    </Panel>
  );
}

function Stories({ names }: { names: string[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Panel padded={false} style={styles.storiesCard}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={names}
        keyExtractor={(n, i) => `${n}-${i}`}
        contentContainerStyle={styles.storiesRow}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.story}
            onPress={() => index === 0 && router.push("/compose")}
            testID={`story-${index}`}
          >
            <RingAvatar size={62} active={index !== 0}>
              {index === 0 ? (
                <MaterialCommunityIcons name="plus" size={22} color={colors.brand} />
              ) : (
                <Text style={[styles.storyInitial, { color: colors.onSurface }]}>{item[0]}</Text>
              )}
            </RingAvatar>
            <Text numberOfLines={1} style={[styles.storyName, { color: colors.muted }]}>
              {item}
            </Text>
          </Pressable>
        )}
      />
    </Panel>
  );
}

function Composer() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Panel style={styles.composer}>
      <Pressable style={styles.composerRow} onPress={() => router.push("/compose")} testID="open-composer">
        <AvatarInitials name="You" size={40} />
        <View style={[styles.composerInput, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
          <Text style={[styles.composerHint, { color: colors.muted }]}>What are you building today?</Text>
        </View>
      </Pressable>
      <Hairline style={{ marginVertical: spacing.md }} />
      <View style={styles.composerActions}>
        <View style={styles.composerAction}>
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Photo</Text>
        </View>
        <View style={styles.composerAction}>
          <MaterialCommunityIcons name="video-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Video</Text>
        </View>
        <View style={styles.composerAction}>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Event</Text>
        </View>
      </View>
    </Panel>
  );
}

function Trending({ items }: { items: string[] }) {
  const { colors } = useTheme();
  return (
    <Panel style={{ marginBottom: spacing.md }}>
      <View style={styles.trendingHead}>
        <MaterialCommunityIcons name="fire" size={18} color={colors.brandSecondary} />
        <Text style={[styles.trendingTitle, { color: colors.onSurface }]}>Trending</Text>
      </View>
      {items.map((t) => (
        <View key={t} style={styles.trendingItem}>
          <Text style={[styles.trendingHash, { color: colors.brand }]}>#</Text>
          <Text style={[styles.trendingText, { color: colors.onSurface }]}>{t}</Text>
        </View>
      ))}
    </Panel>
  );
}

export default function FeedScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh?: boolean) => {
    try {
      if (!isRefresh) setStatus("loading");
      const res = await api.getFeed();
      setData(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onLike = async (id: string) => {
    // optimistic
    setData((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
            ),
          }
        : prev,
    );
    try {
      await api.likePost(id);
    } catch {
      load(true);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <AppHeader
        title="Konphlux"
        subtitle="One ID, every district"
        actions={[
          { icon: "bell-outline", onPress: () => {}, testID: "notif-btn", badge: true },
          { icon: "chat-outline", onPress: () => {}, testID: "msg-btn" },
        ]}
      />
      {status === "loading" ? (
        <Loading label="Stoking the feed…" />
      ) : status === "error" ? (
        <ErrorState onRetry={() => load()} />
      ) : (
        <FlatList
          data={data?.posts ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} onLike={onLike} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <Eyebrow style={{ marginTop: spacing.sm }}>Stories from your circle</Eyebrow>
              <Stories names={data?.stories ?? []} />
              <Composer />
              <Trending items={data?.trending ?? []} />
              <Eyebrow>Latest dispatches</Eyebrow>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  storiesCard: { overflow: "hidden" },
  storiesRow: { padding: spacing.md, gap: spacing.md },
  story: { width: 72, alignItems: "center", gap: 6 },
  storyInitial: { fontFamily: fonts.displaySemi, fontSize: 18 },
  storyName: { fontFamily: fonts.body, fontSize: 11 },

  composer: {},
  composerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  composerInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  composerHint: { fontFamily: fonts.body, fontSize: 14 },
  composerActions: { flexDirection: "row", justifyContent: "space-around" },
  composerAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  composerActionText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  postCard: { marginBottom: spacing.md },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  author: { fontFamily: fonts.displaySemi, fontSize: 15 },
  meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  kindTag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  kindText: { fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  trendingHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: spacing.sm },
  trendingTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
  trendingItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  trendingHash: { fontFamily: fonts.displaySemi, fontSize: 15 },
  trendingText: { fontFamily: fonts.body, fontSize: 14 },
});
