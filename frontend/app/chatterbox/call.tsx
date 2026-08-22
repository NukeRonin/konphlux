import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function CallScreen() {
  const { name, avatar, mode } = useLocalSearchParams<{ name?: string; avatar?: string; mode?: string }>();
  const isVideo = mode === "video";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<"connecting" | "in-call">("connecting");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [camOff, setCamOff] = useState(!isVideo);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase("in-call"), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === "in-call") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const ctrl = (icon: IconName, active: boolean, onPress: () => void, testID: string, danger?: boolean) => (
    <Pressable testID={testID} onPress={onPress} style={[styles.ctrl, { backgroundColor: danger ? "#C0392B" : active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)" }]}>
      <MaterialCommunityIcons name={icon} size={26} color={danger ? "#fff" : active ? "#111" : "#fff"} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.top}>
        <Text style={styles.mode}>{isVideo ? "Video call" : "Voice call"}</Text>
        {avatar ? <Image source={{ uri: avatar as string }} style={[styles.avatar, isVideo && !camOff ? styles.avatarVideo : null]} contentFit="cover" /> : null}
        <Text style={styles.name}>{name || "Contact"}</Text>
        <Text style={styles.status}>{phase === "connecting" ? "Connecting…" : mmss}</Text>
      </View>

      <View style={styles.noteWrap}>
        <MaterialCommunityIcons name="information-outline" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={styles.note}>Live audio/video requires an installed device build. This is a call preview.</Text>
      </View>

      <View style={styles.controls}>
        {ctrl(muted ? "microphone-off" : "microphone", muted, () => setMuted((m) => !m), "call-mute")}
        {isVideo ? ctrl(camOff ? "video-off" : "video", !camOff, () => setCamOff((c) => !c), "call-cam") : ctrl(speaker ? "volume-high" : "volume-low", speaker, () => setSpeaker((s) => !s), "call-speaker")}
        {ctrl("phone-hangup", false, () => router.back(), "call-end", true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#141019", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  top: { alignItems: "center", gap: spacing.md, marginTop: spacing.xxxl },
  mode: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: 1 },
  avatar: { width: 128, height: 128, borderRadius: 64, marginTop: spacing.lg },
  avatarVideo: { width: 220, height: 300, borderRadius: radius.lg },
  name: { fontFamily: fonts.display, fontSize: 26, color: "#fff", marginTop: spacing.md },
  status: { fontFamily: fonts.bodyMedium, fontSize: 15, color: "rgba(255,255,255,0.7)" },
  noteWrap: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: "rgba(255,255,255,0.7)", textAlign: "center", flexShrink: 1 },
  controls: { flexDirection: "row", gap: spacing.xl, alignItems: "center" },
  ctrl: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
});
