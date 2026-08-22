import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSVideoCard } from "@/src/api/client";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSPlaylistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ id: string; title: string; videos: PSVideoCard[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      setData(await api.psPlaylist(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="pspld-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface, flex: 1 }]}>{data?.title ?? "Playlist"}</Text>
      </View>

      {status === "loading" ? (
        <Loading label="Loading playlist…" />
      ) : status === "error" || !data ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={data.videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable testID={`pspld-video-${item.id}`} onPress={() => router.push(`/pictureshow/video/${item.id}`)} style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.index, { color: colors.muted }]}>{index + 1}</Text>
              <View style={styles.thumbWrap}>
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
                <Text numberOfLines={1} style={[styles.sub, { color: colors.muted }]}>{item.channel_name} · {compactNumber(item.views)} views</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="playlist-remove" title="Empty playlist" subtitle="Add videos from any video's Save button." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  index: { fontFamily: fonts.bodyBold, fontSize: 14, width: 18, textAlign: "center" },
  thumbWrap: { width: 120, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18 },
  sub: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
});
