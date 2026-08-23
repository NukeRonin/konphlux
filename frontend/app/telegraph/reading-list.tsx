import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TGArticle } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ReadingList() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<TGArticle[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try { setStatus("loading"); setArticles(await api.tgReadingList()); setStatus("ready"); }
    catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unsave = async (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    try { await api.tgToggleReading(id); } catch { load(); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="rl-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Reading List</Text>
          <Eyebrow>Saved to read later</Eyebrow>
        </View>
      </View>

      <FlatList
        data={articles}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`rl-article-${item.id}`} onPress={() => router.push(`/telegraph/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.cover} contentFit="cover" transition={180} /> : (
              <View style={[styles.cover, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                <MaterialCommunityIcons name="text-box-outline" size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cat, { color: colors.brand }]}>{item.category} · {item.read_minutes} min</Text>
              <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.author, { color: colors.muted }]}>{item.author_name}</Text>
            </View>
            <Pressable onPress={() => unsave(item.id)} hitSlop={10} testID={`rl-remove-${item.id}`} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="bookmark" size={22} color={colors.brand} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching your list…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="bookmark-outline" title="Nothing saved yet" subtitle="Tap the bookmark on any article to add it here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  cover: { width: 64, height: 64, borderRadius: radius.sm },
  cat: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  title: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 20, marginTop: 2 },
  author: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
});
