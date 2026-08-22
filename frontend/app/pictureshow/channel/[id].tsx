import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSChannel } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSChannelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [channel, setChannel] = useState<PSChannel | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      setChannel(await api.psChannel(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleSub = async () => {
    if (!channel) return;
    const res = await api.psSubscribe(channel.id);
    setChannel({ ...channel, subscribed: res.subscribed, subscribers: channel.subscribers + (res.subscribed ? 1 : -1) });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="pschd-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface, flex: 1 }]}>{channel?.name ?? "Channel"}</Text>
      </View>

      {status === "loading" ? (
        <Loading label="Opening the channel…" />
      ) : status === "error" || !channel ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={channel.videos ?? []}
          keyExtractor={(v) => v.id}
          numColumns={1}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.hero}>
              <Image source={{ uri: channel.avatar }} style={styles.avatar} contentFit="cover" />
              <Text style={[styles.name, { color: colors.onSurface }]}>{channel.name}</Text>
              <Text style={[styles.subs, { color: colors.muted }]}>{compactNumber(channel.subscribers)} subscribers</Text>
              {channel.description ? <Text style={[styles.desc, { color: colors.muted }]}>{channel.description}</Text> : null}
              <Pressable testID="pschd-subscribe" onPress={toggleSub} style={[styles.subBtn, { backgroundColor: channel.subscribed ? colors.surfaceTertiary : colors.brand, borderColor: colors.brand }]}>
                <MaterialCommunityIcons name={channel.subscribed ? "bell-check" : "bell-plus"} size={16} color={channel.subscribed ? colors.brand : colors.onBrandPrimary} />
                <Text style={[styles.subText, { color: channel.subscribed ? colors.brand : colors.onBrandPrimary }]}>{channel.subscribed ? "Subscribed" : "Subscribe"}</Text>
              </Pressable>
              <Text style={[styles.videosLabel, { color: colors.onSurface }]}>Videos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable testID={`pschd-video-${item.id}`} onPress={() => router.push(`/pictureshow/video/${item.id}`)} style={styles.card}>
              <View style={styles.thumbWrap}>
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" />
                {item.duration ? <View style={styles.durBadge}><Text style={styles.durText}>{item.duration}</Text></View> : null}
              </View>
              <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.cardSub, { color: colors.muted }]}>{compactNumber(item.views)} views</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  hero: { alignItems: "center", gap: 4, marginBottom: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.sm },
  name: { fontFamily: fonts.display, fontSize: 22 },
  subs: { fontFamily: fonts.body, fontSize: 13 },
  desc: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  subBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
  subText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  videosLabel: { fontFamily: fonts.display, fontSize: 18, alignSelf: "flex-start", marginTop: spacing.xl },
  card: { gap: spacing.sm },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  durBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 18 },
  cardSub: { fontFamily: fonts.body, fontSize: 12 },
});
