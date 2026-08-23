import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSHub, PSVideoCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const QUICK: { label: string; icon: IconName; route: string }[] = [
  { label: "Browse", icon: "movie-open", route: "/pictureshow/videos" },
  { label: "Trending", icon: "fire", route: "/pictureshow/videos?sort=trending" },
  { label: "Channels", icon: "account-group", route: "/pictureshow/channels" },
  { label: "Subscriptions", icon: "bell-ring", route: "/pictureshow/subscriptions" },
  { label: "Playlists", icon: "playlist-play", route: "/pictureshow/playlists" },
  { label: "Upload", icon: "upload", route: "/pictureshow/upload" },
  { label: "AI Video", icon: "movie-filter", route: "/pictureshow/ai?kind=video" },
  { label: "AI Animation", icon: "animation-play", route: "/pictureshow/ai?kind=animation" },
  { label: "Characters", icon: "account-star", route: "/pictureshow/characters" },
  { label: "My Projects", icon: "folder-multiple", route: "/pictureshow/projects" },
];

function VideoThumb({ item, wide }: { item: PSVideoCard; wide?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable testID={`ps-video-${item.id}`} onPress={() => router.push(`/pictureshow/video/${item.id}`)} style={[styles.card, { width: wide ? 260 : "100%" }]}>
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
  );
}

export default function PictureShowHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PSHub | null>(null);
  const [cont, setCont] = useState<(PSVideoCard & { progress: number })[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [hub, c] = await Promise.all([api.psHub(), api.psContinue()]);
      setData(hub);
      setCont(c.videos);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="ps-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>
            PictureShow
          </Text>
          <Eyebrow>Moving pictures, all hours</Eyebrow>
        </View>
        <Pressable testID="ps-upload-btn" onPress={() => router.push("/pictureshow/upload")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="upload" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {/* Segmented: Theatre vs Streamora */}
      <View style={[styles.segRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.segItem, styles.segActive, { borderColor: colors.brand, backgroundColor: colors.surfaceTertiary }]}>
          <MaterialCommunityIcons name="movie-open" size={16} color={colors.brand} />
          <Text style={[styles.segText, { color: colors.brand }]}>Theatre</Text>
        </View>
        <Pressable testID="ps-seg-streamora" onPress={() => router.push("/pictureshow/streamora")} style={[styles.segItem, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="video-wireless" size={16} color={colors.muted} />
          <Text style={[styles.segText, { color: colors.muted }]}>Streamora Live</Text>
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Threading the reels…" />
      ) : status === "error" || !data ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Streamora branch banner */}
          <Pressable testID="ps-streamora-banner" onPress={() => router.push("/pictureshow/streamora")} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <LinearGradient colors={["#8B1E1E", "#C0392B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streamBanner}>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveNow}>STREAMORA · LIVE</Text>
              </View>
              <Text style={styles.streamTitle}>Go live &amp; watch live broadcasts</Text>
              <Text style={styles.streamSub}>{data.live_count} streaming now · the live branch of PictureShow →</Text>
            </LinearGradient>
          </Pressable>

          {/* Quick actions */}
          <View style={styles.grid}>
            {QUICK.map((q) => (
              <Pressable key={q.label} testID={`ps-quick-${q.label}`} onPress={() => router.push(q.route as any)} style={[styles.gridItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={q.icon} size={22} color={colors.brand} />
                <Text style={[styles.gridText, { color: colors.onSurface }]}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Continue Watching */}
          {cont.length > 0 ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Continue watching</Text>
                <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.brand} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {cont.map((v) => (
                  <Pressable key={v.id} testID={`ps-continue-${v.id}`} onPress={() => router.push(`/pictureshow/video/${v.id}`)} style={[styles.card, { width: 260 }]}>
                    <View style={styles.thumbWrap}>
                      <Image source={{ uri: v.thumbnail }} style={styles.thumb} contentFit="cover" transition={200} />
                      <View style={styles.resumeBadge}><MaterialCommunityIcons name="play" size={12} color="#fff" /><Text style={styles.resumeText}>Resume</Text></View>
                      <View style={styles.progTrack}><View style={[styles.progFill, { width: `${Math.round(v.progress * 100)}%`, backgroundColor: colors.brand }]} /></View>
                    </View>
                    <View style={styles.cardMeta}>
                      <Image source={{ uri: v.channel_avatar }} style={styles.avatar} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{v.title}</Text>
                        <Text numberOfLines={1} style={[styles.cardSub, { color: colors.muted }]}>{v.channel_name}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Trending */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Trending in the Theatre</Text>
            <MaterialCommunityIcons name="fire" size={18} color={colors.brand} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {data.trending.map((v) => (
              <VideoThumb key={v.id} item={v} wide />
            ))}
          </ScrollView>

          {/* Channels */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Popular channels</Text>
            <Pressable testID="ps-channels-all" onPress={() => router.push("/pictureshow/channels")}>
              <Text style={[styles.seeAll, { color: colors.brand }]}>All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {data.channels.map((c) => (
              <Pressable key={c.id} testID={`ps-channel-${c.id}`} onPress={() => router.push(`/pictureshow/channel/${c.id}`)} style={styles.channelCard}>
                <Image source={{ uri: c.avatar }} style={styles.channelAvatar} contentFit="cover" />
                <Text numberOfLines={1} style={[styles.channelName, { color: colors.onSurface }]}>{c.name}</Text>
                <Text style={[styles.channelSubs, { color: colors.muted }]}>{compactNumber(c.subscribers)} subs</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Latest */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Fresh from the projector</Text>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
            {data.featured.map((v) => (
              <VideoThumb key={v.id} item={v} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  segRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.pill, borderWidth: 1 },
  segActive: { borderWidth: 1.5 },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  streamBanner: { borderRadius: radius.md, padding: spacing.lg, gap: 4 },
  liveDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
  liveNow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5, color: "#fff" },
  streamTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: "#fff", marginTop: 2 },
  streamSub: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: "#fff", opacity: 0.92 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  gridItem: { width: "23.5%", aspectRatio: 0.95, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 3 },
  gridText: { fontFamily: fonts.bodyBold, fontSize: 10, textAlign: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18 },
  resumeBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  resumeText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  progTrack: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  progFill: { height: 4 },
  seeAll: { fontFamily: fonts.bodyBold, fontSize: 13 },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  durBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  cardMeta: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 18 },
  cardSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  channelCard: { width: 96, alignItems: "center", gap: 4 },
  channelAvatar: { width: 64, height: 64, borderRadius: 32 },
  channelName: { fontFamily: fonts.bodyBold, fontSize: 12, textAlign: "center" },
  channelSubs: { fontFamily: fonts.body, fontSize: 11 },
});
