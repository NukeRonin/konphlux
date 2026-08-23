import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TGAuthor } from "@/src/api/client";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Stat({ value, label, colors }: { value: number; label: string; colors: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export default function WriterProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [author, setAuthor] = useState<TGAuthor | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const a = await api.tgAuthor(id!);
      setAuthor(a);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async () => {
    if (!author || busy) return;
    setBusy(true);
    setAuthor({ ...author, following: !author.following, followers_count: author.followers_count + (author.following ? -1 : 1) });
    try { await api.tgFollowAuthor(author.author_id); } catch { load(); } finally { setBusy(false); }
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening the writer's desk…" /></View>;
  if (status === "error" || !author) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="tg-author-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={author.articles}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.avatarText, { color: colors.brand }]}>{(author.author_name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.name, { color: colors.onSurface }]}>{author.author_name}</Text>
            {author.author_handle ? <Text style={[styles.handle, { color: colors.muted }]}>{author.author_handle}</Text> : null}

            <View style={styles.statsRow}>
              <Stat value={author.article_count} label="Articles" colors={colors} />
              <Stat value={author.followers_count} label="Followers" colors={colors} />
              <Stat value={author.total_likes} label="Likes" colors={colors} />
            </View>

            {!author.is_me ? (
              <Pressable
                testID="tg-author-follow"
                onPress={toggleFollow}
                style={[styles.followBtn, { backgroundColor: author.following ? colors.surfaceSecondary : colors.brand, borderColor: author.following ? colors.border : colors.brand }]}
              >
                <MaterialCommunityIcons name={author.following ? "account-check" : "account-plus"} size={17} color={author.following ? colors.brand : colors.onBrandPrimary} />
                <Text style={[styles.followText, { color: author.following ? colors.brand : colors.onBrandPrimary }]}>{author.following ? "Following" : "Follow"}</Text>
              </Pressable>
            ) : (
              <View style={[styles.mePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.followText, { color: colors.muted }]}>This is you</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Articles</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`tg-author-article-${item.id}`} onPress={() => router.push(`/telegraph/${item.id}`)} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowCat, { color: colors.brand }]}>{item.category.toUpperCase()}</Text>
              <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.rowMeta, { color: colors.muted }]}>{timeAgo(item.created_at)} · {item.read_minutes} min · {item.likes} likes · {item.comments_count} responses</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="feather" title="No articles yet" subtitle="This writer hasn't published anything down the wire." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  header: { alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 34 },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md },
  handle: { fontFamily: fonts.body, fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  stat: { alignItems: "center" },
  statValue: { fontFamily: fonts.displaySemi, fontSize: 20 },
  statLabel: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.lg },
  mePill: { height: 44, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  followText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 18, alignSelf: "flex-start", marginTop: spacing.xl, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1 },
  rowCat: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4 },
  rowTitle: { fontFamily: fonts.displaySemi, fontSize: 16.5, lineHeight: 22, marginTop: 3 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 4 },
});
