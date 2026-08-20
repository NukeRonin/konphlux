import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBVideo } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function Videos() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<BBVideo[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setVideos(await api.bbVideos());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} onPress={() => router.back()} testID="videos-back" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Video Lessons</Text>
          <Eyebrow>Watch and learn</Eyebrow>
        </View>
      </View>

      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`video-${item.id}`} onPress={() => Linking.openURL(item.url)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name="play-circle" size={28} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.topic} · {item.duration}</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Cueing the reels…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="play-circle" title="No videos yet" />
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
