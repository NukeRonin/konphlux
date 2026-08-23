import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl, SparkCard, SparkMessage, uploadDatingVoice } from "@/src/api/client";
import { AudioPreview } from "@/src/components/AudioPreview";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function sexEmoji(gender: string | null): string {
  if (gender === "woman") return "🍑";
  if (gender === "man") return "🍆";
  return "🍑🍆";
}

const FLIRT_LINE = "Is it warm in here, or is that just the spark between us? 😏";
const SEX_LINE = "I can't stop thinking about you. Care to make some heat together tonight? 🔥";
const ICEBREAKERS = [
  "If we split a hot-air balloon, are you a window or aisle person? 🎈",
  "Quick — describe your soul as a steampunk gadget. ⚙️",
  "Two truths and a lie about your last adventure. Go. ✨",
  "You're clearly trouble. What's your best terrible pun?",
  "Copperpot cocoa or aether-fizz spritz — pick your poison? ☕",
];

export default function SparkChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<SparkCard | null>(null);
  const [messages, setMessages] = useState<SparkMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingVoice, setPendingVoice] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.datingThread(id);
      setProfile(res.profile);
      setMessages(res.messages);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const send = async (bodyText: string, kind: "message" | "flirt" | "sex_request") => {
    const t = bodyText.trim();
    if (!t || busy || !id) return;
    setBusy(true);
    if (kind === "message") setText("");
    try {
      const res = await api.datingThreadSend(id, t, kind);
      setMessages((prev) => [...prev, res.message, ...(res.reply ? [res.reply] : [])]);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const startRecording = async () => {
    if (busy || uploading || !id) return;
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert("Microphone needed", "Enable microphone access in Settings to send voice notes.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
      }
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      recorder.record();
      setRecording(true);
    } catch { setRecording(false); }
  };

  const stopAndSend = async () => {
    if (!recording) return;
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) setPendingVoice(uri); // preview before sending
    } catch { /* ignore */ }
  };

  const sendVoice = async () => {
    if (!pendingVoice || !id) return;
    setUploading(true);
    try {
      const path = await uploadDatingVoice(pendingVoice, Platform.OS === "web");
      const url = fileUrl(path);
      const res = await api.datingThreadSend(id, "🎤 Voice note", "voice", url);
      setMessages((prev) => [...prev, res.message, ...(res.reply ? [res.reply] : [])]);
      setPendingVoice(null);
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const discardVoice = () => setPendingVoice(null);

  const renderItem = ({ item }: { item: SparkMessage }) => (
    <View style={[styles.bubbleRow, { justifyContent: item.mine ? "flex-end" : "flex-start" }]}>
      <View style={[styles.bubble, item.mine
        ? { backgroundColor: colors.brand, borderTopRightRadius: 4 }
        : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 }]}
      >
        {item.kind === "sex_request" ? <Text style={styles.kindTag}>{sexEmoji(profile?.gender ?? null)} Request</Text> : item.kind === "flirt" ? <Text style={styles.kindTag}>😏 Flirt</Text> : null}
        {item.kind === "voice" && item.media_url ? (
          <View style={{ minWidth: 200 }}>
            <Text style={[styles.kindTag, { marginBottom: 4 }]}>🎤 Voice note</Text>
            <AudioPreview uri={item.media_url} />
          </View>
        ) : (
          <Text style={[styles.bubbleText, { color: item.mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.body}</Text>
        )}
      </View>
    </View>
  );

  const lastMine = [...messages].reverse().find((m) => m.mine);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="sparkchat-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        {profile?.photo ? <Image source={{ uri: profile.photo }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]} />}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerName, { color: colors.onSurface }]}>{profile?.display_name ?? "Spark"}</Text>
          {profile?.tagline ? <Text numberOfLines={1} style={[styles.headerSub, { color: colors.muted }]}>{profile.tagline}</Text> : null}
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Opening your thread…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              lastMine ? (
                <View style={styles.receiptRow}>
                  <MaterialCommunityIcons name={lastMine.seen ? "check-all" : "check"} size={13} color={lastMine.seen ? colors.brand : colors.muted} />
                  <Text style={[styles.receipt, { color: lastMine.seen ? colors.brand : colors.muted }]}>{lastMine.seen ? "Seen" : "Sent"}</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="chat-outline" size={40} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>Say hello, send a flirt, or make a bold move.</Text>
              </View>
            }
          />
          <KeyboardStickyView>
            {pendingVoice ? (
              <View style={[styles.previewBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewLabel, { color: colors.muted }]}>Preview your voice note</Text>
                  <AudioPreview uri={pendingVoice} />
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Pressable testID="voice-send" disabled={uploading} onPress={sendVoice} style={[styles.vSend, { backgroundColor: colors.brand }]}>
                    {uploading ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <MaterialCommunityIcons name="send" size={18} color={colors.onBrandPrimary} />}
                  </Pressable>
                  <Pressable testID="voice-rerecord" disabled={uploading} onPress={discardVoice} style={[styles.vRedo, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="microphone-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {messages.length === 0 ? (
              <View style={[styles.iceWrap, { borderTopColor: colors.border }]}>
                <Text style={[styles.iceTitle, { color: colors.muted }]}>💡 Icebreakers — tap to use</Text>
                <FlatList
                  horizontal
                  data={ICEBREAKERS}
                  keyExtractor={(m) => m}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
                  renderItem={({ item }) => (
                    <Pressable testID="icebreaker" onPress={() => setText(item)} style={[styles.iceChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brandSecondary }]}>
                      <Text style={[styles.iceText, { color: colors.onSurface }]}>{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
            ) : null}
            <View style={[styles.quickRow, { borderTopColor: colors.border }]}>
              <Pressable testID="chat-flirt" disabled={busy} onPress={() => send(FLIRT_LINE, "flirt")} style={[styles.quickBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brandSecondary }]}>
                <Text style={styles.quickEmoji}>😏</Text>
                <Text style={[styles.quickText, { color: colors.onSurface }]}>Flirt</Text>
              </Pressable>
              <Pressable testID="chat-sex-request" disabled={busy} onPress={() => send(SEX_LINE, "sex_request")} style={[styles.quickBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={styles.quickEmoji}>{sexEmoji(profile?.gender ?? null)}</Text>
                <Text style={[styles.quickText, { color: colors.onSurface }]}>Sex Request</Text>
              </Pressable>
            </View>
            <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm }]}>
              <Pressable
                testID="chat-mic"
                disabled={uploading}
                onPress={recording ? stopAndSend : startRecording}
                style={[styles.micBtn, { backgroundColor: recording ? "#C0392B" : colors.surfaceSecondary, borderColor: recording ? "#C0392B" : colors.border }]}
              >
                {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : <MaterialCommunityIcons name={recording ? "stop" : "microphone"} size={20} color={recording ? "#fff" : colors.brand} />}
              </Pressable>
              <TextInput
                testID="chat-input"
                value={text}
                onChangeText={setText}
                placeholder={recording ? "Recording… tap stop to send" : "Write a message…"}
                placeholderTextColor={colors.muted}
                editable={!recording}
                style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                multiline
              />
              <Pressable testID="chat-send" disabled={busy || !text.trim()} onPress={() => send(text, "message")} style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name="send" size={20} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          </KeyboardStickyView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headerName: { fontFamily: fonts.displaySemi, fontSize: 16 },
  headerSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  kindTag: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: "#E7CD94", marginBottom: 2, letterSpacing: 0.3 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  receiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, paddingRight: spacing.xs, paddingTop: 4 },
  receipt: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingTop: spacing.xxxl },
  emptyText: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
  quickRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1 },
  iceWrap: { paddingTop: spacing.sm, paddingBottom: spacing.xs, borderTopWidth: 1 },
  iceTitle: { fontFamily: fonts.bodyBold, fontSize: 11.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  iceChip: { maxWidth: 240, borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iceText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  micBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1 },
  previewLabel: { fontFamily: fonts.bodyBold, fontSize: 11.5, marginBottom: 6 },
  vSend: { width: 44, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  vRedo: { width: 44, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  quickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.pill, borderWidth: 1.5 },
  quickEmoji: { fontSize: 16 },
  quickText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 10, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
