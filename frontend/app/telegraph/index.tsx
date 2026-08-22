import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TGArticle } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All Articles" },
  { key: "new", label: "New" },
  { key: "popular", label: "Popular" },
  { key: "trending", label: "Trending" },
  { key: "following", label: "Following" },
];

const TAB_EMPTY: Record<string, { icon: IconName; title: string; subtitle: string }> = {
  all: { icon: "newspaper-variant-outline", title: "No articles yet", subtitle: "Tap Post to publish the first piece down the wire." },
  new: { icon: "clock-outline", title: "Nothing new yet", subtitle: "Freshly published articles will appear here." },
  popular: { icon: "fire", title: "No popular articles yet", subtitle: "The most-liked pieces will rise to the top." },
  trending: { icon: "trending-up", title: "Nothing trending yet", subtitle: "Articles gaining likes this week will show here." },
  following: { icon: "account-heart-outline", title: "You're not following anyone yet", subtitle: "Open an article and follow its writer to fill this feed." },
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TelegraphGallery() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [tab, setTab] = useState<string>(params.filter && TABS.some((t) => t.key === params.filter) ? params.filter : "all");
  const [articles, setArticles] = useState<TGArticle[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const list = await api.tgArticles(tab);
      setArticles(list);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="tg-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Article Gallery</Text>
          <Eyebrow>Short thoughts and long essays</Eyebrow>
        </View>
        <Pressable testID="tg-new" onPress={() => router.push("/telegraph/new")} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="feather" size={19} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(t) => t.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          renderItem={({ item }) => {
            const active = tab === item.key;
            return (
              <Pressable
                testID={`tg-tab-${item.key}`}
                onPress={() => setTab(item.key)}
                style={[styles.tabChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}
              >
                <Text style={[styles.tabText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={articles}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`tg-article-${item.id}`} onPress={() => router.push(`/telegraph/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
            ) : null}
            <View style={styles.cardBody}>
              <View style={styles.metaRow}>
                <View style={[styles.catBadge, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.catText, { color: colors.brand }]}>{item.category}</Text>
                </View>
                <Text style={[styles.metaDim, { color: colors.muted }]}>{item.read_minutes} min read</Text>
                <Text style={[styles.metaDim, { color: colors.muted }]}>· {timeAgo(item.created_at)}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={3} style={[styles.excerpt, { color: colors.muted }]}>{item.excerpt}</Text>
              <View style={styles.byRow}>
                <View style={styles.byLeft}>
                  <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={[styles.avatarText, { color: colors.brand }]}>{(item.author_name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.author, { color: colors.onSurface }]}>{item.author_name}</Text>
                  {item.following ? <MaterialCommunityIcons name="account-heart" size={14} color={colors.brand} /> : null}
                </View>
                <View style={styles.likeRow}>
                  <MaterialCommunityIcons name={item.liked ? "heart" : "heart-outline"} size={15} color={item.liked ? colors.brand : colors.muted} />
                  <Text style={[styles.likeText, { color: colors.muted }]}>{item.likes}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching the dispatches…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon={TAB_EMPTY[tab].icon} title={TAB_EMPTY[tab].title} subtitle={TAB_EMPTY[tab].subtitle} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tabRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tabChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 150 },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catBadge: { height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill, justifyContent: "center" },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  metaDim: { fontFamily: fonts.body, fontSize: 12 },
  title: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 25, marginTop: 4 },
  excerpt: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  byRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  byLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  author: { fontFamily: fonts.bodyMedium, fontSize: 13, flexShrink: 1 },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
});
