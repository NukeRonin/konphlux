import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LibraryBook } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Stats = { hours_this_month: number; minutes_this_month: number; total_hours: number; books_finished_this_month: number; books_finished_total: number };
type AllMark = { id: string; book_id: string; page: number; note: string; created_at: string; book_title: string; book_cover: string; book_format: string };

export default function Library() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [marks, setMarks] = useState<AllMark[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [b, s, m] = await Promise.all([
        api.libraryEbooks(),
        api.libraryStats().catch(() => null),
        api.libraryAllBookmarks().catch(() => []),
      ]);
      setBooks(b); setStats(s); setMarks(m);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openMark = (m: AllMark) => {
    if (m.book_format === "Audio Book") router.push(`/library/audio/${m.book_id}`);
    else router.push(`/library/read/${m.book_id}?p=${m.page}`);
  };

  const listenLabel = stats
    ? (stats.hours_this_month >= 1 ? `${stats.hours_this_month}h` : `${stats.minutes_this_month}m`)
    : "0m";

  const Header = () => (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <View style={[styles.statsCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <View style={styles.statBox}>
          <MaterialCommunityIcons name="headphones" size={20} color={colors.brand} />
          <Text style={[styles.statNum, { color: colors.onSurface }]}>{listenLabel}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Listened this month</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statBox}>
          <MaterialCommunityIcons name="book-check-outline" size={20} color={colors.brand} />
          <Text style={[styles.statNum, { color: colors.onSurface }]}>{stats?.books_finished_this_month ?? 0}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Finished this month</Text>
        </View>
      </View>

      {marks.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Your bookmarks</Text>
          {marks.map((m) => (
            <Pressable key={m.id} testID={`sync-mark-${m.id}`} onPress={() => openMark(m)} style={[styles.markRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="bookmark" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.markTitle, { color: colors.onSurface }]}>{m.book_title}</Text>
                <Text numberOfLines={1} style={[styles.markSub, { color: colors.muted }]}>Page {m.page + 1}{m.note ? ` · ${m.note}` : ""}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {books.length ? <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: marks.length ? spacing.sm : 0 }]}>Your books</Text> : null}
    </View>
  );

  const remove = (b: LibraryBook) => {
    Alert.alert(b.title, "Remove this eBook from your Library?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { setBooks((p) => p.filter((x) => x.id !== b.id)); try { await api.libraryDeleteEbook(b.id); } catch { load(); } } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="lib-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Library</Text>
          <Eyebrow>Your downloaded eBooks</Eyebrow>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/bazaar?category=eBooks")} hitSlop={10} testID="lib-store" style={[styles.storeBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="store-plus-outline" size={18} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={status === "ready" ? <Header /> : null}
        renderItem={({ item }) => (
          <Pressable testID={`lib-book-${item.id}`} onPress={() => router.push(item.format === "Audio Book" ? `/library/audio/${item.id}` : `/library/read/${item.id}`)} onLongPress={() => remove(item)} delayLongPress={280} style={[styles.book, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.cover} contentFit="cover" transition={180} /> : (
              <View style={[styles.cover, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={30} color={colors.muted} />
              </View>
            )}
            <View style={{ padding: spacing.sm, gap: 2 }}>
              <View style={[styles.fmt, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.fmtText, { color: colors.brand }]}>{item.format}{item.pages ? ` · ${item.pages}p` : ""}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.author, { color: colors.muted }]}>{item.author}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Opening your Library…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="bookshelf" title="Your Library is empty" subtitle="Buy eBooks in the Bazaar and they'll be downloaded here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  storeBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  book: { flex: 1, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 150 },
  fmt: { alignSelf: "flex-start", height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center" },
  fmtText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 18, marginTop: 3 },
  author: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  statsCard: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.md },
  statBox: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 44 },
  statNum: { fontFamily: fonts.display, fontSize: 22 },
  statLbl: { fontFamily: fonts.body, fontSize: 11.5, textAlign: "center" },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17 },
  markRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  markTitle: { fontFamily: fonts.displaySemi, fontSize: 14 },
  markSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
