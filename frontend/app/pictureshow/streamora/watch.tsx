import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VideoPlayer } from "@/src/components/VideoPlayer";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const LIVE = "#C0392B";

function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function StreamWatch() {
  const { url, title, channel, status, when } = useLocalSearchParams<{ url?: string; title?: string; channel?: string; status?: string; when?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";
  const hasVideo = !!url;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="watch-back" style={[styles.roundBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {hasVideo ? (
        <VideoPlayer uri={url as string} style={{ borderRadius: 0 }} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: "#000" }]}>
          <MaterialCommunityIcons name={isUpcoming ? "calendar-clock" : "video-off"} size={40} color="#fff" />
          <Text style={styles.placeholderText}>{isUpcoming ? "This stream hasn't started yet" : "Replay unavailable"}</Text>
        </View>
      )}

      <View style={{ padding: spacing.lg }}>
        {isLive ? (
          <View style={[styles.liveTag, { backgroundColor: LIVE }]}>
            <View style={styles.dot} />
            <Text style={styles.liveTagText}>LIVE NOW</Text>
          </View>
        ) : null}
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.channel, { color: colors.muted }]}>{channel}</Text>
        {isUpcoming && when ? (
          <View style={[styles.schedCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
            <Text style={[styles.schedText, { color: colors.onSurface }]}>Scheduled for {fmtDate(when as string)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.md },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  placeholder: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", gap: spacing.md },
  placeholderText: { color: "#fff", fontFamily: fonts.bodyMedium, fontSize: 14 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm },
  liveTagText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  title: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 25 },
  channel: { fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  schedCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  schedText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
