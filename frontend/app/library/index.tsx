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

export default function Library() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try { setStatus("loading"); setBooks(await api.libraryEbooks()); setStatus("ready"); }
    catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        renderItem={({ item }) => (
          <Pressable testID={`lib-book-${item.id}`} onLongPress={() => remove(item)} delayLongPress={280} style={[styles.book, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
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
});
