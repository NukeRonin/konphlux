import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSVideoDetail } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSVideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState<PSVideoDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      setVideo(await api.psVideo(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = async () => {
    if (!video) return;
    const res = await api.psLike(video.id);
    setVideo({ ...video, liked: res.liked, likes: res.likes });
  };

  const toggleSub = async () => {
    if (!video) return;
    const res = await api.psSubscribe(video.channel_id);
    setVideo({ ...video, subscribed: res.subscribed });
  };

  const addToPlaylist = async (pid: string) => {
    if (!video) return;
    await api.psPlaylistAdd(pid, video.id);
    setShowPlaylists(false);
    setSavedMsg("Added to playlist");
    setTimeout(() => setSavedMsg(""), 1800);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psvd-back" style={[styles.roundBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Cueing the picture…" />
      ) : status === "error" || !video ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <VideoPlayer uri={video.video_url} style={{ borderRadius: 0 }} onProgress={(pos, dur) => { api.psProgress(video.id, pos, dur).catch(() => {}); }} />

          <View style={{ padding: spacing.lg }}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{video.title}</Text>
            <Text style={[styles.stats, { color: colors.muted }]}>{compactNumber(video.views)} views · {video.category}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable testID="psvd-like" onPress={toggleLike} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: video.liked ? colors.brand : colors.border }]}>
                <MaterialCommunityIcons name={video.liked ? "thumb-up" : "thumb-up-outline"} size={18} color={video.liked ? colors.brand : colors.onSurface} />
                <Text style={[styles.actionText, { color: video.liked ? colors.brand : colors.onSurface }]}>{compactNumber(video.likes)}</Text>
              </Pressable>
              <Pressable testID="psvd-save" onPress={() => setShowPlaylists(true)} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="playlist-plus" size={18} color={colors.onSurface} />
                <Text style={[styles.actionText, { color: colors.onSurface }]}>Save</Text>
              </Pressable>
            </View>
            {savedMsg ? <Text style={[styles.savedMsg, { color: colors.brand }]}>{savedMsg}</Text> : null}

            <Pressable
              testID="psvd-watch-party"
              onPress={async () => { try { const p = await api.partyCreate(video.id); router.push(`/pictureshow/party/${p.code}`); } catch { /* ignore */ } }}
              style={[styles.partyBtn, { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary }]}
            >
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color={colors.brand} />
              <Text style={[styles.partyText, { color: colors.brand }]}>Watch together</Text>
            </Pressable>

            {/* Channel */}
            <Pressable testID="psvd-channel" onPress={() => router.push(`/pictureshow/channel/${video.channel_id}`)} style={[styles.channelRow, { borderColor: colors.border }]}>
              <Image source={{ uri: video.channel_avatar }} style={styles.channelAvatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.channelName, { color: colors.onSurface }]}>{video.channel_name}</Text>
                <Text style={[styles.channelSubs, { color: colors.muted }]}>{compactNumber(video.channel_subscribers)} subscribers</Text>
              </View>
              <Pressable testID="psvd-subscribe" onPress={toggleSub} style={[styles.subBtn, { backgroundColor: video.subscribed ? colors.surfaceTertiary : colors.brand, borderColor: colors.brand }]}>
                <Text style={[styles.subText, { color: video.subscribed ? colors.brand : colors.onBrandPrimary }]}>{video.subscribed ? "Subscribed" : "Subscribe"}</Text>
              </Pressable>
            </Pressable>

            {video.description ? <Text style={[styles.desc, { color: colors.muted }]}>{video.description}</Text> : null}

            {/* Related */}
            {video.related.length > 0 ? (
              <>
                <Text style={[styles.relatedTitle, { color: colors.onSurface }]}>Up next</Text>
                {video.related.map((r) => (
                  <Pressable key={r.id} testID={`psvd-related-${r.id}`} onPress={() => router.replace(`/pictureshow/video/${r.id}`)} style={styles.relRow}>
                    <View style={styles.relThumbWrap}>
                      <Image source={{ uri: r.thumbnail }} style={styles.relThumb} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[styles.relTitle, { color: colors.onSurface }]}>{r.title}</Text>
                      <Text numberOfLines={1} style={[styles.relSub, { color: colors.muted }]}>{r.channel_name} · {compactNumber(r.views)} views</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Save to playlist modal */}
      <Modal visible={showPlaylists} transparent animationType="fade" onRequestClose={() => setShowPlaylists(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPlaylists(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Save to playlist</Text>
            {video?.my_playlists.length ? (
              video.my_playlists.map((p) => (
                <Pressable key={p.id} testID={`psvd-pl-${p.id}`} onPress={() => addToPlaylist(p.id)} style={[styles.plRow, { borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="playlist-play" size={20} color={colors.brand} />
                  <Text style={[styles.plText, { color: colors.onSurface }]}>{p.title}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.plEmpty, { color: colors.muted }]}>No playlists yet. Create one from the Playlists screen.</Text>
            )}
            <Pressable testID="psvd-pl-manage" onPress={() => { setShowPlaylists(false); router.push("/pictureshow/playlists"); }} style={[styles.plManage, { borderColor: colors.brand }]}>
              <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
              <Text style={[styles.plManageText, { color: colors.brand }]}>Manage playlists</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  title: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 25 },
  stats: { fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1 },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  savedMsg: { fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.sm },
  partyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1.5, marginTop: spacing.md },
  partyText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, marginTop: spacing.md },
  channelAvatar: { width: 44, height: 44, borderRadius: 22 },
  channelName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  channelSubs: { fontFamily: fonts.body, fontSize: 12 },
  subBtn: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  relatedTitle: { fontFamily: fonts.display, fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.md },
  relRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  relThumbWrap: { width: 140, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: "hidden" },
  relThumb: { width: "100%", height: "100%" },
  relTitle: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17 },
  relSub: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.sm },
  plRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  plText: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  plEmpty: { fontFamily: fonts.body, fontSize: 13, paddingVertical: spacing.sm },
  plManage: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, marginTop: spacing.sm },
  plManageText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
