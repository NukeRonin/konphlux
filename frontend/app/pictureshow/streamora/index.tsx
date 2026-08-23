import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSStream, PSStreamoraHub, PSVideoCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

const LIVE = "#C0392B";

function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function StreamoraHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PSStreamoraHub | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setData(await api.streamoraHub());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const watch = (s: PSStream) => {
    const following = (data?.followed ?? []).some((c) => c.id === s.channel_id);
    router.push({ pathname: "/pictureshow/streamora/watch", params: { id: s.id, url: s.video_url, title: s.title, channel: s.channel_name, channelId: s.channel_id, status: s.status, when: s.scheduled_at, following: following ? "1" : "0" } });
  };

  const streamCard = (s: PSStream) => (
    <Pressable key={s.id} testID={`streamora-${s.id}`} onPress={() => watch(s)} style={styles.card}>
      <View style={styles.thumbWrap}>
        <Image source={{ uri: s.thumbnail }} style={styles.thumb} contentFit="cover" transition={200} />
        {s.status === "live" ? (
          <View style={[styles.liveBadge, { backgroundColor: LIVE }]}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
        {s.status === "live" ? (
          <View style={styles.viewers}>
            <MaterialCommunityIcons name="eye" size={11} color="#fff" />
            <Text style={styles.viewersText}>{compactNumber(s.viewers)}</Text>
          </View>
        ) : null}
        {s.status === "upcoming" ? (
          <View style={[styles.liveBadge, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
            <MaterialCommunityIcons name="clock-outline" size={11} color="#fff" />
            <Text style={styles.liveText}>SOON</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardMeta}>
        <Image source={{ uri: s.channel_avatar }} style={styles.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{s.title}</Text>
          <Text numberOfLines={1} style={[styles.cardSub, { color: colors.muted }]}>
            {s.channel_name}{s.status === "upcoming" && s.scheduled_at ? ` · ${fmtDate(s.scheduled_at)}` : s.status === "recent" ? ` · ${compactNumber(s.viewers)} watched` : ""}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const clipCard = (c: PSVideoCard & { video_url: string }) => (
    <Pressable key={c.id} testID={`streamora-clip-${c.id}`} onPress={() => router.push({ pathname: "/pictureshow/streamora/watch", params: { id: c.id, url: c.video_url, title: c.title, channel: c.channel_name, status: "recent", when: "" } })} style={styles.clipCard}>
      <View style={styles.clipThumbWrap}>
        <Image source={{ uri: c.thumbnail }} style={styles.thumb} contentFit="cover" />
        <View style={styles.clipPlay}><MaterialCommunityIcons name="play" size={16} color="#fff" /></View>
      </View>
      <Text numberOfLines={2} style={[styles.clipTitle, { color: colors.onSurface }]}>{c.title}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="streamora-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Streamora</Text>
            <View style={[styles.liveTag, { backgroundColor: LIVE }]}><Text style={styles.liveTagText}>LIVE</Text></View>
          </View>
          <Eyebrow>The live branch of PictureShow</Eyebrow>
        </View>
        <Pressable testID="streamora-golive" onPress={() => router.push("/pictureshow/streamora/golive")} style={[styles.goLiveBtn, { backgroundColor: LIVE }]}>
          <MaterialCommunityIcons name="broadcast" size={16} color="#fff" />
          <Text style={styles.goLiveText}>Go live</Text>
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Tuning the aether waves…" />
      ) : status === "error" || !data ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Live now */}
          <View style={styles.sectionHead}>
            <View style={[styles.dot, { backgroundColor: LIVE }]} />
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Live now</Text>
          </View>
          {data.live.length ? data.live.map(streamCard) : <Text style={[styles.empty, { color: colors.muted }]}>No one is live right now. Be the first — tap “Go live”.</Text>}

          {/* Your live reactions (recap for streams you host) */}
          {data.your_streams.length ? (
            <>
              <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
                <MaterialCommunityIcons name="party-popper" size={18} color={colors.brand} />
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Your live reactions</Text>
              </View>
              {data.your_streams.map((s) => (
                <View key={s.id} testID={`recap-${s.id}`} style={[styles.recapCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.recapTitle, { color: colors.onSurface }]}>{s.title}</Text>
                    <Text style={[styles.recapMeta, { color: colors.muted }]}>
                      {s.status === "live" ? "Live now" : s.status === "upcoming" ? "Upcoming" : "Recent"} · {s.total_reactions} {s.total_reactions === 1 ? "cheer" : "cheers"}
                    </Text>
                  </View>
                  {s.total_reactions > 0 ? (
                    <View style={styles.recapTop}>
                      {s.top.map((t) => (
                        <View key={t.emoji} style={styles.recapTopItem}>
                          <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                          <Text style={[styles.recapTopCount, { color: colors.muted }]}>{t.count}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.recapMeta, { color: colors.muted }]}>No cheers yet</Text>
                  )}
                </View>
              ))}
            </>
          ) : null}

          {/* Upcoming */}
          <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md }]}>Upcoming streams</Text>
          {data.upcoming.length ? data.upcoming.map(streamCard) : <Text style={[styles.empty, { color: colors.muted }]}>Nothing scheduled yet.</Text>}

          {/* Recent */}
          <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md }]}>Recent broadcasts</Text>
          {data.recent.length ? data.recent.map(streamCard) : <Text style={[styles.empty, { color: colors.muted }]}>No recent replays.</Text>}

          {/* Clips */}
          {data.clips.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md }]}>Clips &amp; highlights</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                {data.clips.map(clipCard)}
              </ScrollView>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  liveTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  liveTagText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
  goLiveBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  goLiveText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 13 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  card: { gap: spacing.sm, marginBottom: spacing.lg },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  liveBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
  viewers: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  viewersText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10 },
  cardMeta: { flexDirection: "row", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 19 },
  cardSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 13, paddingVertical: spacing.sm },
  clipCard: { width: 130, gap: 6 },
  clipThumbWrap: { width: 130, height: 200, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  clipPlay: { position: "absolute", top: "50%", left: "50%", marginLeft: -16, marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  clipTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  recapCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  recapTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  recapMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  recapTop: { flexDirection: "row", gap: spacing.md },
  recapTopItem: { alignItems: "center" },
  recapTopCount: { fontFamily: fonts.bodyBold, fontSize: 11, marginTop: 1 },
});
