import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TGArticle } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { ErrorState, Loading } from "@/src/components/States";
import { TGComments } from "@/src/components/TGComments";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function fullDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function TelegraphReader() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<TGArticle | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const a = await api.tgArticle(id!);
      setArticle(a);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleLike = async () => {
    if (!article || busy) return;
    setBusy(true);
    // optimistic
    setArticle({ ...article, liked: !article.liked, likes: article.likes + (article.liked ? -1 : 1) });
    try { await api.tgLikeArticle(article.id); } catch { load(); } finally { setBusy(false); }
  };

  const toggleFollow = async () => {
    if (!article || busy) return;
    setBusy(true);
    setArticle({ ...article, following: !article.following });
    try { await api.tgFollowAuthor(article.author_id); } catch { load(); } finally { setBusy(false); }
  };

  const share = async () => {
    if (!article) return;
    try { await Share.share({ message: `${article.title}\n\nby ${article.author_name} on Konphlux Telegraph\n\n${article.excerpt}` }); } catch { /* ignore */ }
  };

  const confirmDelete = () => {
    if (!article) return;
    Alert.alert("Delete article?", `"${article.title}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.tgDeleteArticle(article.id); router.back(); } catch { /* ignore */ } } },
    ]);
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening the article…" /></View>;
  if (status === "error" || !article) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  const isOwner = user?.id === article.author_id;
  const paragraphs = article.body.split("\n").filter((p) => p.trim().length > 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="tg-reader-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable onPress={share} hitSlop={10} testID="tg-share">
            <MaterialCommunityIcons name="share-variant" size={21} color={colors.onSurface} />
          </Pressable>
          {isOwner ? (
            <>
              <Pressable onPress={() => router.push(`/telegraph/new?id=${article.id}`)} hitSlop={10} testID="tg-edit">
                <MaterialCommunityIcons name="pencil-outline" size={21} color={colors.onSurface} />
              </Pressable>
              <Pressable onPress={confirmDelete} hitSlop={10} testID="tg-delete">
                <MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.error ?? colors.muted} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <View style={[styles.catBadge, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[styles.catText, { color: colors.brand }]}>{article.category}</Text>
          </View>
          {article.status === "draft" ? (
            <View style={[styles.draftBadge, { backgroundColor: colors.surfaceTertiary, borderColor: colors.brand }]}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={13} color={colors.brand} />
              <Text style={[styles.draftText, { color: colors.brand }]}>Draft</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>{article.title}</Text>

        <View style={styles.authorRow}>
          <Pressable style={styles.authorTap} onPress={() => router.push(`/telegraph/author/${article.author_id}`)} testID="tg-author">
            <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.avatarText, { color: colors.brand }]}>{(article.author_name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.author, { color: colors.onSurface }]}>{article.author_name}</Text>
              <Text style={[styles.byMeta, { color: colors.muted }]}>{fullDate(article.created_at)} · {article.read_minutes} min read</Text>
            </View>
          </Pressable>
          {!isOwner ? (
            <Pressable
              testID="tg-follow"
              onPress={toggleFollow}
              style={[styles.followBtn, { backgroundColor: article.following ? colors.surfaceSecondary : colors.brand, borderColor: article.following ? colors.border : colors.brand }]}
            >
              <MaterialCommunityIcons name={article.following ? "account-check" : "account-plus"} size={15} color={article.following ? colors.brand : colors.onBrandPrimary} />
              <Text style={[styles.followText, { color: article.following ? colors.brand : colors.onBrandPrimary }]}>{article.following ? "Following" : "Follow"}</Text>
            </Pressable>
          ) : null}
        </View>

        {article.cover_url ? (
          <Image source={{ uri: article.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
        ) : null}

        <View style={styles.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={[styles.paragraph, { color: colors.onSurface }]}>{p}</Text>
          ))}
        </View>

        {article.status !== "draft" ? <TGComments articleId={article.id} /> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable testID="tg-like" onPress={toggleLike} style={[styles.likeBtn, { backgroundColor: article.liked ? colors.brand : colors.surfaceSecondary, borderColor: article.liked ? colors.brand : colors.border }]}>
          <MaterialCommunityIcons name={article.liked ? "heart" : "heart-outline"} size={19} color={article.liked ? colors.onBrandPrimary : colors.brand} />
          <Text style={[styles.likeBtnText, { color: article.liked ? colors.onBrandPrimary : colors.brand }]}>
            {article.liked ? "Liked" : "Like"} · {article.likes}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, maxWidth: 720, width: "100%", alignSelf: "center" },
  catBadge: { alignSelf: "flex-start", height: 24, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center" },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
  topLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  draftBadge: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  draftText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  authorTap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, marginTop: spacing.md },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 17 },
  author: { fontFamily: fonts.bodyBold, fontSize: 15 },
  byMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  followText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  cover: { width: "100%", height: 210, borderRadius: radius.md, marginTop: spacing.lg },
  body: { marginTop: spacing.lg, gap: spacing.md },
  paragraph: { fontFamily: fonts.body, fontSize: 17, lineHeight: 28 },
  footer: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  likeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: radius.md, borderWidth: 1 },
  likeBtnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
