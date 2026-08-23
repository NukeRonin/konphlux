import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, StreamChatMsg } from "@/src/api/client";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { ConfettiBurst } from "@/src/components/ConfettiBurst";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const LIVE = "#C0392B";
const CHEERS = ["❤️", "🔥", "👏", "😂", "😮", "⚙️"];
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const lastMilestone = (n: number) => MILESTONES.filter((m) => m <= n).pop() ?? 0;

function FloatingCheer({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: -220, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: (Math.random() - 0.5) * 80, duration: 2200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.Text style={{ position: "absolute", bottom: 0, fontSize: 30, transform: [{ translateY: y }, { translateX: x }], opacity }}>{emoji}</Animated.Text>;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

export default function StreamWatch() {
  const { id, url, title, channel, channelId, status, when, following } = useLocalSearchParams<{ id?: string; url?: string; title?: string; channel?: string; channelId?: string; status?: string; when?: string; following?: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLive = status === "live";
  const isUpcoming = status === "upcoming";
  const hasVideo = !!url;
  const showChat = !!id && (isLive || status === "recent");

  const [isFollowing, setIsFollowing] = useState(following === "1");
  const [messages, setMessages] = useState<StreamChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const [cheers, setCheers] = useState<{ id: string; emoji: string }[]>([]);
  const [recap, setRecap] = useState<{ total: number; top: { emoji: string; count: number }[] }>({ total: 0, top: [] });
  const [confetti, setConfetti] = useState(false);
  const [milestoneLabel, setMilestoneLabel] = useState<number | null>(null);
  const milestoneRef = useRef<number | null>(null);
  const chime = useAudioPlayer(require("@/assets/sounds/chime.wav"));

  // Celebrate when the show crosses a cheer milestone (skips pre-existing totals on first load).
  useEffect(() => {
    const reached = lastMilestone(recap.total);
    if (milestoneRef.current === null) {
      milestoneRef.current = reached; // baseline on first load — no celebration
      return;
    }
    if (reached > milestoneRef.current) {
      milestoneRef.current = reached;
      setConfetti(true);
      setMilestoneLabel(reached);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      try { chime.seekTo(0); chime.play(); } catch { /* ignore */ }
      setTimeout(() => setMilestoneLabel(null), 3200);
    }
  }, [recap.total]);

  const cheer = (emoji: string) => {
    const cid = Math.random().toString(36).slice(2);
    setCheers((c) => [...c, { id: cid, emoji }]);
    if (id) {
      setRecap((r) => ({ total: r.total + 1, top: r.top }));
      api.streamoraReact(id, emoji).catch(() => {});
    }
  };

  const loadChat = useCallback(async () => {
    if (!showChat) return;
    try { setMessages(await api.streamoraChat(id!)); } catch { /* ignore */ }
    try { setRecap(await api.streamoraReactions(id!)); } catch { /* ignore */ }
  }, [id, showChat]);

  useEffect(() => { loadChat(); }, [loadChat]);

  // Poll for new messages while live to keep the chat feeling alive.
  useEffect(() => {
    if (!isLive || !id) return;
    const t = setInterval(loadChat, 5000);
    return () => clearInterval(t);
  }, [isLive, id, loadChat]);

  const toggleFollow = async () => {
    if (!channelId) return;
    setIsFollowing((f) => !f);
    try { await api.streamoraFollow(channelId); } catch { setIsFollowing((f) => !f); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !id) return;
    setText(""); setSending(true);
    try {
      const m = await api.streamoraChatPost(id, body);
      setMessages((p) => [...p, m]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch { setText(body); } finally { setSending(false); }
  };

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

      <View style={styles.metaBar}>
        <View style={{ flex: 1 }}>
          {isLive ? (
            <View style={[styles.liveTag, { backgroundColor: LIVE }]}>
              <View style={styles.dot} />
              <Text style={styles.liveTagText}>LIVE NOW</Text>
            </View>
          ) : null}
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
          <Text style={[styles.channel, { color: colors.muted }]}>{channel}</Text>
        </View>
        {channelId ? (
          <Pressable onPress={toggleFollow} testID="watch-follow" style={[styles.followBtn, { backgroundColor: isFollowing ? colors.surfaceSecondary : colors.brand, borderColor: isFollowing ? colors.border : colors.brand }]}>
            <MaterialCommunityIcons name={isFollowing ? "bell-check" : "bell-plus-outline"} size={15} color={isFollowing ? colors.brand : colors.onBrandPrimary} />
            <Text style={[styles.followText, { color: isFollowing ? colors.brand : colors.onBrandPrimary }]}>{isFollowing ? "Following" : "Follow"}</Text>
          </Pressable>
        ) : null}
      </View>

      {showChat ? (
        <View style={styles.cheerBar}>
          <View style={styles.cheerFloat} pointerEvents="none">
            {cheers.map((c) => <FloatingCheer key={c.id} emoji={c.emoji} onDone={() => setCheers((list) => list.filter((x) => x.id !== c.id))} />)}
          </View>
          {CHEERS.map((e) => (
            <Pressable key={e} onPress={() => cheer(e)} testID={`cheer-${e}`} style={[styles.cheerBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          ))}
          {recap.total > 0 ? (
            <View style={[styles.recapChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="cheer-recap">
              <Text style={styles.recapEmoji}>{recap.top.slice(0, 3).map((t) => t.emoji).join("")}</Text>
              <Text style={[styles.recapCount, { color: colors.onSurface }]}>{recap.total}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {isUpcoming && when ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={[styles.schedCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.brand} />
            <Text style={[styles.schedText, { color: colors.onSurface }]}>Scheduled for {fmtDate(when as string)}</Text>
          </View>
        </View>
      ) : null}

      {showChat ? (
        <View style={[styles.chat, { borderTopColor: colors.border }]}>
          <View style={[styles.chatHead, { borderBottomColor: colors.border }]}>
            <MaterialCommunityIcons name="chat-processing-outline" size={17} color={colors.brand} />
            <Text style={[styles.chatTitle, { color: colors.onSurface }]}>{isLive ? "Live chat" : "Stream chat"}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.chatCount, { color: colors.muted }]}>{messages.length} messages</Text>
          </View>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={styles.msgRow}>
                <Text style={[styles.msgAuthor, { color: item.user_id === user?.id ? colors.brand : colors.brandSecondary }]}>{item.author}</Text>
                <Text style={[styles.msgBody, { color: colors.onSurface }]}> {item.body}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.chatEmpty, { color: colors.muted }]}>Say hello 👋</Text>}
          />
          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
              <TextInput value={text} onChangeText={setText} placeholder="Chat with the stream…" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="chat-input" onSubmitEditing={send} returnKeyType="send" />
              <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]} testID="chat-send">
                <MaterialCommunityIcons name="send" size={17} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          </KeyboardStickyView>
        </View>
      ) : null}

      {milestoneLabel != null ? (
        <View style={styles.milestoneToast} pointerEvents="none">
          <Text style={styles.milestoneEmoji}>🎉</Text>
          <Text style={styles.milestoneText}>{milestoneLabel} cheers! The crowd loves your show</Text>
        </View>
      ) : null}
      {confetti ? <ConfettiBurst onDone={() => setConfetti(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.md },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  placeholder: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", gap: spacing.md },
  placeholderText: { color: "#fff", fontFamily: fonts.bodyMedium, fontSize: 14 },
  metaBar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm },
  liveTagText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  title: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 25 },
  channel: { fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  followText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  cheerBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  cheerFloat: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center", height: 0 },
  cheerBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  recapChip: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, marginLeft: "auto" },
  recapEmoji: { fontSize: 15 },
  recapCount: { fontFamily: fonts.bodyBold, fontSize: 14 },
  milestoneToast: { position: "absolute", top: "42%", left: spacing.xl, right: spacing.xl, backgroundColor: "rgba(0,0,0,0.82)", borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: "center", gap: 4, zIndex: 20 },
  milestoneEmoji: { fontSize: 30 },
  milestoneText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "center" },
  schedCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  schedText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  chat: { flex: 1, borderTopWidth: 1 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  chatTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  chatCount: { fontFamily: fonts.body, fontSize: 12 },
  msgRow: { flexDirection: "row", flexWrap: "wrap" },
  msgAuthor: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  msgBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, flexShrink: 1 },
  chatEmpty: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
