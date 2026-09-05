import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, DBProject, District, FeedResponse, Post, Thread } from "@/src/api/client";
import { AppHeader } from "@/src/components/AppHeader";
import { AvatarInitials, RingAvatar } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { maybeRequestReview } from "@/src/utils/rateApp";
import { compactNumber, fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

function PostCard({ post, onLike, onSave }: { post: Post; onLike: (id: string) => void; onSave: (id: string) => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const share = async () => { try { await Share.share({ message: `${post.author} on Konphlux:\n\n${post.body}` }); } catch { /* ignore */ } };
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
        <Pressable onPress={() => router.push("/compose")} hitSlop={8} style={styles.actionBtn} testID={`comment-${post.id}`}>
          <MaterialCommunityIcons name="comment-outline" size={18} color={colors.muted} />
          <Text style={[styles.actionText, { color: colors.muted }]}>{compactNumber(post.comments)}</Text>
        </Pressable>
        <Pressable onPress={share} hitSlop={8} style={styles.actionBtn} testID={`share-${post.id}`}>
          <MaterialCommunityIcons name="share-variant" size={18} color={colors.muted} />
          <Text style={[styles.actionText, { color: colors.muted }]}>Share</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => onSave(post.id)} hitSlop={8} testID={`save-${post.id}`}>
          <MaterialCommunityIcons
            name={post.saved ? "bookmark" : "bookmark-outline"}
            size={19}
            color={post.saved ? colors.brand : colors.muted}
          />
        </Pressable>
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
        <Pressable style={styles.composerAction} onPress={() => router.push("/compose")} testID="composer-photo">
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Photo</Text>
        </Pressable>
        <Pressable style={styles.composerAction} onPress={() => router.push("/compose")} testID="composer-video">
          <MaterialCommunityIcons name="video-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Video</Text>
        </Pressable>
        <Pressable style={styles.composerAction} onPress={() => router.push("/evention")} testID="composer-event">
          <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.brand} />
          <Text style={[styles.composerActionText, { color: colors.onSurface }]}>Event</Text>
        </Pressable>
      </View>
    </Panel>
  );
}

function DistrictStrip({ districts }: { districts: District[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  if (districts.length === 0) return null;
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={districts}
      keyExtractor={(d) => d.slug}
      contentContainerStyle={styles.districtStrip}
      renderItem={({ item }) => (
        <Pressable
          testID={`home-district-${item.slug}`}
          onPress={() => router.push(`/district/${item.slug}`)}
          style={styles.districtChip}
        >
          <LinearGradient
            colors={colors.brassGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.districtIcon, { borderColor: colors.brandSecondary }]}
          >
            <MaterialCommunityIcons
              name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={24}
              color={colors.onBrandPrimary}
            />
          </LinearGradient>
          <Text numberOfLines={1} style={[styles.districtName, { color: colors.onSurface }]}>
            {item.name}
          </Text>
        </Pressable>
      )}
    />
  );
}

function Trending({ items }: { items: string[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Panel style={{ marginBottom: spacing.md }}>
      <View style={styles.trendingHead}>
        <MaterialCommunityIcons name="fire" size={18} color={colors.brandSecondary} />
        <Text style={[styles.trendingTitle, { color: colors.onSurface }]}>Trending</Text>
      </View>
      {items.map((t) => (
        <Pressable key={t} style={styles.trendingItem} onPress={() => router.push("/roundtable")} testID={`trending-${t}`}>
          <Text style={[styles.trendingHash, { color: colors.brand }]}>#</Text>
          <Text style={[styles.trendingText, { color: colors.onSurface }]}>{t}</Text>
        </Pressable>
      ))}
    </Panel>
  );
}

function DreambackerRow() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<DBProject[]>([]);

  useEffect(() => {
    api.dbProjects("trending").then((list) => setItems(list.slice(0, 8))).catch(() => {});
  }, []);

  if (items.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={dbrStyles.rowHead}>
        <Eyebrow>Trending fundraisers</Eyebrow>
        <Pressable testID="home-db-all" onPress={() => router.push("/dreambacker")} hitSlop={8}>
          <Text style={[dbrStyles.seeAll, { color: colors.brand }]}>See all</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
        renderItem={({ item }) => (
          <Pressable testID={`home-db-${item.id}`} onPress={() => router.push(`/dreambacker/${item.id}`)} style={[dbrStyles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[dbrStyles.cover, { backgroundColor: colors.surfaceTertiary }]}>
              {item.cover_url ? <Image source={{ uri: item.cover_url }} style={dbrStyles.coverImg} contentFit="cover" /> : <MaterialCommunityIcons name="hand-heart" size={26} color={colors.brand} />}
              {item.funded ? (
                <View style={[dbrStyles.funded, { backgroundColor: colors.brand }]}>
                  <Text style={[dbrStyles.fundedText, { color: colors.onBrandPrimary }]}>Funded!</Text>
                </View>
              ) : null}
            </View>
            <View style={{ padding: spacing.sm, gap: 4 }}>
              <Text numberOfLines={2} style={[dbrStyles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <View style={[dbrStyles.track, { backgroundColor: colors.surfaceTertiary }]}>
                <View style={[dbrStyles.fill, { backgroundColor: colors.brand, width: `${Math.round(item.progress * 100)}%` }]} />
              </View>
              <Text style={[dbrStyles.meta, { color: colors.muted }]}>{Math.round(item.progress * 100)}% · {item.backer_count} backers</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const dbrStyles = StyleSheet.create({
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { fontFamily: fonts.bodyBold, fontSize: 13 },
  card: { width: 200, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 100, alignItems: "center", justifyContent: "center" },
  coverImg: { width: "100%", height: "100%" },
  funded: { position: "absolute", top: 8, left: 8, paddingHorizontal: 8, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fundedText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 18 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  meta: { fontFamily: fonts.body, fontSize: 11.5 },
});

function RoundtableTrending() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Thread[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.rtTrending().then((list) => { if (alive) setItems(list.slice(0, 8)); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  if (items.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={dbrStyles.rowHead}>
        <Eyebrow>🔥 Hot discussions this week</Eyebrow>
        <Pressable testID="home-rt-all" onPress={() => router.push("/roundtable")} hitSlop={8}>
          <Text style={[dbrStyles.seeAll, { color: colors.brand }]}>See all</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
        renderItem={({ item }) => (
          <Pressable testID={`home-rt-${item.id}`} onPress={() => router.push(`/roundtable/thread/${item.id}`)} style={[rtStyles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={rtStyles.cardHead}>
              <MaterialCommunityIcons name="forum" size={14} color={colors.brand} />
              <Text numberOfLines={1} style={[rtStyles.comm, { color: colors.brand }]}>{item.category || item.community_name}</Text>
            </View>
            <Text numberOfLines={3} style={[rtStyles.title, { color: colors.onSurface }]}>{item.title}</Text>
            <View style={rtStyles.metaRow}>
              <MaterialCommunityIcons name="arrow-up-bold" size={13} color={colors.muted} />
              <Text style={[rtStyles.meta, { color: colors.muted }]}>{compactNumber(item.upvotes)}</Text>
              <MaterialCommunityIcons name="comment-outline" size={13} color={colors.muted} style={{ marginLeft: 8 }} />
              <Text style={[rtStyles.meta, { color: colors.muted }]}>{item.reply_count}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const rtStyles = StyleSheet.create({
  card: { width: 210, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: 6, justifyContent: "space-between" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  comm: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3, flex: 1 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14.5, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12 },
});

function StreakReminder() {
  const { colors } = useTheme();
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.libraryStats()
        .then((s) => { if (alive) { setStreak(s.streak_days); setShow(s.streak_days > 0 && !s.listened_today); } })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  if (!show || dismissed) return null;
  return (
    <Pressable
      testID="home-streak-reminder"
      onPress={() => router.push("/library")}
      style={[srStyles.banner, { backgroundColor: "rgba(230,126,34,0.12)", borderColor: "rgba(230,126,34,0.4)" }]}
    >
      <MaterialCommunityIcons name="fire" size={22} color="#E67E22" />
      <View style={{ flex: 1 }}>
        <Text style={[srStyles.title, { color: colors.onSurface }]}>Keep your {streak}-day streak alive!</Text>
        <Text style={[srStyles.sub, { color: colors.muted }]}>Listen or read a little today so you don't lose it.</Text>
      </View>
      <Pressable hitSlop={10} onPress={() => setDismissed(true)} testID="streak-dismiss">
        <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const srStyles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
});

export default function FeedScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh?: boolean) => {
    try {
      if (!isRefresh) setStatus("loading");
      const [res, dists] = await Promise.all([api.getFeed(), api.getDistricts()]);
      setData(res);
      setDistricts(dists);
      setStatus("ready");
    } catch {
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Ask for an app-store rating after the user has returned a few times.
  useEffect(() => {
    const t = setTimeout(() => { maybeRequestReview(); }, 4000);
    return () => clearTimeout(t);
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

  const onSave = async (id: string) => {
    setData((prev) =>
      prev
        ? { ...prev, posts: prev.posts.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)) }
        : prev,
    );
    try {
      await api.toggleSave("post", id);
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
          { icon: "bell-outline", onPress: () => router.push("/notifications"), testID: "notif-btn", badge: true },
          { icon: "chat-outline", onPress: () => router.push("/chatterbox"), testID: "msg-btn" },
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
          renderItem={({ item }) => <PostCard post={item} onLike={onLike} onSave={onSave} />}
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
              <StreakReminder />
              <Eyebrow style={{ marginTop: spacing.sm }}>Stories from your circle</Eyebrow>
              <Stories names={data?.stories ?? []} />
              <Composer />
              <Eyebrow>Explore districts</Eyebrow>
              <DistrictStrip districts={districts} />
              <DreambackerRow />
              <RoundtableTrending />
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
  districtStrip: { gap: spacing.md, paddingVertical: spacing.xs },
  districtChip: { width: 72, alignItems: "center", gap: 6 },
  districtIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  districtName: { fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: "center" },  storiesRow: { padding: spacing.md, gap: spacing.md },
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
