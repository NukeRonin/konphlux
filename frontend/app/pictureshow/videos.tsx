import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSVideoCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSVideos() {
  const params = useLocalSearchParams<{ sort?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<"recent" | "trending">(params.sort === "trending" ? "trending" : "recent");
  const [category, setCategory] = useState<string | null>(null);
  const [videos, setVideos] = useState<PSVideoCard[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.psVideos(category ?? undefined, sort);
      setVideos(res.videos);
      setCategories(res.categories);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [category, sort]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psvideos-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Videos</Text>
          <Eyebrow>The Theatre</Eyebrow>
        </View>
        <Pressable testID="ps-sort" onPress={() => setSort((s) => (s === "recent" ? "trending" : "recent"))} style={[styles.sortBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name={sort === "trending" ? "fire" : "clock-outline"} size={15} color={colors.brand} />
          <Text style={[styles.sortText, { color: colors.onSurface }]}>{sort === "trending" ? "Trending" : "Recent"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <Pressable testID="pscat-all" onPress={() => setCategory(null)} style={[styles.catChip, { backgroundColor: !category ? colors.surfaceTertiary : "transparent", borderColor: !category ? colors.brand : colors.border }]}>
              <Text style={[styles.catText, { color: !category ? colors.brand : colors.muted }]}>All</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable key={c} testID={`pscat-${c}`} onPress={() => setCategory(category === c ? null : c)} style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}>
                <Text style={[styles.catText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <Pressable testID={`psvideo-${item.id}`} onPress={() => router.push(`/pictureshow/video/${item.id}`)} style={styles.card}>
            <View style={styles.thumbWrap}>
              <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" transition={200} />
              {item.duration ? (
                <View style={styles.durBadge}>
                  <Text style={styles.durText}>{item.duration}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardMeta}>
              <Image source={{ uri: item.channel_avatar }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
                <Text numberOfLines={1} style={[styles.cardSub, { color: colors.muted }]}>{item.channel_name} · {compactNumber(item.views)} views</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Rolling film…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="movie-open" title="No videos here yet" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  sortText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  list: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  catRow: { gap: spacing.sm, paddingBottom: spacing.md },
  catChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  card: { gap: spacing.sm },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  durBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  cardMeta: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 19 },
  cardSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
