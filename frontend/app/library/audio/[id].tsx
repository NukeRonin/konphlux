import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LibraryBook } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

// Demo narration track (real audiobook files would be attached per title).
const SAMPLE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

function fmt(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioBookPlayer() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const player = useAudioPlayer(SAMPLE);
  const st = useAudioPlayerStatus(player);
  const seekedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try { setStatus("loading"); setBook(await api.libraryGetEbook(id!)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Resume from saved position once the track is loaded.
  useEffect(() => {
    const resume = (book as any)?.audio_position ?? 0;
    if (book && st.isLoaded && !seekedRef.current && resume > 1) {
      seekedRef.current = true;
      player.seekTo(resume);
    }
  }, [book, st.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist position every few seconds and on unmount.
  useEffect(() => {
    if (!id) return;
    saveTimer.current = setInterval(() => {
      if (st.currentTime > 0) api.libraryAudioProgress(id, st.currentTime).catch(() => {});
    }, 5000);
    return () => {
      if (saveTimer.current) clearInterval(saveTimer.current);
      if (st.currentTime > 0) api.libraryAudioProgress(id, st.currentTime).catch(() => {});
      player.pause();
    };
  }, [id, st.currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Loading audiobook…" /></View>;
  if (status === "error" || !book) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  const dur = st.duration || 1;
  const pct = Math.min(1, (st.currentTime || 0) / dur);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="audio-back">
          <MaterialCommunityIcons name="chevron-down" size={28} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {book.cover_url ? <Image source={{ uri: book.cover_url }} style={styles.cover} contentFit="cover" transition={200} /> : (
          <View style={[styles.cover, { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}><MaterialCommunityIcons name="headphones" size={54} color={colors.muted} /></View>
        )}
        <Text style={[styles.title, { color: colors.onSurface }]}>{book.title}</Text>
        <Text style={[styles.author, { color: colors.muted }]}>{book.author} · Audiobook</Text>

        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.brand }]} />
        </View>
        <View style={styles.times}>
          <Text style={[styles.timeText, { color: colors.muted }]}>{fmt(st.currentTime || 0)}</Text>
          <Text style={[styles.timeText, { color: colors.muted }]}>{fmt(dur)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={() => player.seekTo(Math.max(0, (st.currentTime || 0) - 15))} testID="audio-back15" hitSlop={8}>
            <MaterialCommunityIcons name="rewind-15" size={38} color={colors.onSurface} />
          </Pressable>
          <Pressable onPress={() => (st.playing ? player.pause() : player.play())} testID="audio-playpause" style={[styles.playBtn, { backgroundColor: colors.brand }]}>
            <MaterialCommunityIcons name={st.playing ? "pause" : "play"} size={38} color={colors.onBrandPrimary} />
          </Pressable>
          <Pressable onPress={() => player.seekTo(Math.min(dur, (st.currentTime || 0) + 30))} testID="audio-fwd30" hitSlop={8}>
            <MaterialCommunityIcons name="fast-forward-30" size={38} color={colors.onSurface} />
          </Pressable>
        </View>
        <Text style={[styles.resumeHint, { color: colors.muted }]}>Your place is saved automatically.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  body: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  cover: { width: 220, height: 220, borderRadius: radius.lg, marginTop: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 24, textAlign: "center", marginTop: spacing.lg },
  author: { fontFamily: fonts.body, fontSize: 14 },
  track: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden", marginTop: spacing.xl },
  fill: { height: 6, borderRadius: 3 },
  times: { width: "100%", flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.xxl, marginTop: spacing.lg },
  playBtn: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  resumeHint: { fontFamily: fonts.body, fontSize: 12, marginTop: spacing.md },
});
