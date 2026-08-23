import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LibraryBook } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Bookmark = { id: string; page: number; note: string; created_at: string };

export default function EbookReader() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const listRef = useRef<FlatList>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showMarks, setShowMarks] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [b, marks] = await Promise.all([api.libraryGetEbook(id!), api.libraryBookmarks(id!)]);
      setBook(b);
      setBookmarks(marks);
      setPage(Math.min(b.progress_page ?? 0, (b.content?.length ?? 1) - 1));
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Jump to the saved page once content + width are known.
  useEffect(() => {
    if (status === "ready" && book?.content?.length && page > 0) {
      const t = setTimeout(() => listRef.current?.scrollToOffset({ offset: page * width, animated: false }), 60);
      return () => clearTimeout(t);
    }
  }, [status, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrollEnd = (e: any) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p === page) return;
    setPage(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { api.libraryProgress(id!, p).catch(() => {}); }, 400);
  };

  const total = book?.content?.length ?? 1;
  const isMarked = bookmarks.some((b) => b.page === page && !b.note);

  const toggleBookmark = async () => {
    await api.libraryAddBookmark(id!, page).catch(() => {});
    setBookmarks(await api.libraryBookmarks(id!).catch(() => bookmarks));
  };
  const jumpTo = (p: number) => {
    setShowMarks(false);
    listRef.current?.scrollToOffset({ offset: p * width, animated: true });
    setPage(p);
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening your book…" /></View>;
  if (status === "error" || !book) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="reader-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{book.title}</Text>
        <Pressable onPress={toggleBookmark} hitSlop={10} testID="reader-bookmark">
          <MaterialCommunityIcons name={isMarked ? "bookmark" : "bookmark-outline"} size={22} color={isMarked ? colors.brand : colors.onSurface} />
        </Pressable>
        <Pressable onPress={() => setShowMarks(true)} hitSlop={10} testID="reader-marks">
          <MaterialCommunityIcons name="bookmark-multiple-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={book.content ?? []}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width, padding: spacing.xl, justifyContent: "center" }}>
            <Text style={[styles.pageText, { color: colors.onSurface }]}>{item}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
        <Pressable disabled={page === 0} onPress={() => listRef.current?.scrollToOffset({ offset: (page - 1) * width, animated: true })} testID="reader-prev" hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left-circle-outline" size={30} color={page === 0 ? colors.border : colors.brand} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: spacing.lg }}>
          <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
            <View style={[styles.fill, { backgroundColor: colors.brand, width: `${((page + 1) / total) * 100}%` }]} />
          </View>
          <Text style={[styles.pageNo, { color: colors.muted }]}>Page {page + 1} of {total}</Text>
        </View>
        <Pressable disabled={page >= total - 1} onPress={() => listRef.current?.scrollToOffset({ offset: (page + 1) * width, animated: true })} testID="reader-next" hitSlop={8}>
          <MaterialCommunityIcons name="chevron-right-circle-outline" size={30} color={page >= total - 1 ? colors.border : colors.brand} />
        </Pressable>
      </View>

      <Modal visible={showMarks} transparent animationType="slide" onRequestClose={() => setShowMarks(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowMarks(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Bookmarks</Text>
            {bookmarks.length === 0 ? (
              <Text style={[styles.sheetEmpty, { color: colors.muted }]}>Tap the bookmark icon to save your spot.</Text>
            ) : bookmarks.map((b) => (
              <Pressable key={b.id} onPress={() => jumpTo(b.page)} style={[styles.markRow, { borderBottomColor: colors.border }]} testID={`mark-${b.id}`}>
                <MaterialCommunityIcons name="bookmark" size={18} color={colors.brand} />
                <Text style={[styles.markText, { color: colors.onSurface }]}>Page {b.page + 1}{b.note ? ` — ${b.note}` : ""}</Text>
                <Pressable hitSlop={8} onPress={async () => { await api.libraryDeleteBookmark(id!, b.id).catch(() => {}); setBookmarks((p) => p.filter((x) => x.id !== b.id)); }}>
                  <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
                </Pressable>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17, flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "60%" },
  sheetTitle: { fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: spacing.md },
  sheetEmpty: { fontFamily: fonts.body, fontSize: 14, paddingVertical: spacing.lg },
  markRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1 },
  markText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5 },
  pageText: { fontFamily: fonts.body, fontSize: 18, lineHeight: 30 },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  pageNo: { fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: "center", marginTop: 5 },
});
