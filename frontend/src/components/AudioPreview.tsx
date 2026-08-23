import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compact play/pause + progress bar for a remote audio URL (expo-audio). */
export function AudioPreview({ uri, title }: { uri: string; title?: string }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);

  const toggle = () => {
    if (st.playing) player.pause();
    else {
      if (st.duration > 0 && st.currentTime >= st.duration - 0.2) player.seekTo(0);
      player.play();
    }
  };

  const pct = st.duration > 0 ? Math.min(1, st.currentTime / st.duration) : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
      <Pressable testID="audio-preview-toggle" onPress={toggle} style={[styles.playBtn, { backgroundColor: colors.brand }]}>
        <MaterialCommunityIcons name={st.playing ? "pause" : "play"} size={26} color={colors.onBrandPrimary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {title ? <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{title}</Text> : null}
        <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.brand }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.muted }]}>{fmt(st.currentTime)}</Text>
          <Text style={[styles.time, { color: colors.muted }]}>{st.isLoaded ? fmt(st.duration) : "…"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  playBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, marginBottom: 6 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  time: { fontFamily: fonts.body, fontSize: 11 },
});
