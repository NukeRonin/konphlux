import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSChannelLite, PSVideoCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSSubscriptions() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<PSChannelLite[]>([]);
  const [videos, setVideos] = useState<PSVideoCard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.psSubscriptions();
      setChannels(res.channels);
      setVideos(res.videos);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="pssubs-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Subscriptions</Text>
          <Eyebrow>From channels you follow</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Checking your subscriptions…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : channels.length === 0 ? (
        <EmptyState icon="bell-off-outline" title="No subscriptions yet" subtitle="Subscribe to channels to see their latest here." />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chanRow}>
              {channels.map((c) => (
                <Pressable key={c.id} testID={`pssub-chan-${c.id}`} onPress={() => router.push(`/pictureshow/channel/${c.id}`)} style={styles.chanCard}>
                  <Image source={{ uri: c.avatar }} style={styles.chanAvatar} contentFit="cover" />
                  <Text numberOfLines={1} style={[styles.chanName, { color: colors.onSurface }]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          }
          renderItem={({ item }) => (
            <Pressable testID={`pssub-video-${item.id}`} onPress={() => router.push(`/pictureshow/video/${item.id}`)} style={styles.card}>
              <View style={styles.thumbWrap}>
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
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
          ListEmptyComponent={<EmptyState icon="movie-open-outline" title="Nothing new" subtitle="Your channels haven't posted yet." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  chanRow: { gap: spacing.md, paddingBottom: spacing.md },
  chanCard: { width: 76, alignItems: "center", gap: 4 },
  chanAvatar: { width: 60, height: 60, borderRadius: 30 },
  chanName: { fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: "center" },
  card: { gap: spacing.sm },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  cardMeta: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 19 },
  cardSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
