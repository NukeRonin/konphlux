import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, StreamChatMsg, PartyParticipant, CBConvSummary } from "@/src/api/client";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { ErrorState, Loading } from "@/src/components/States";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function WatchParty() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [party, setParty] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [messages, setMessages] = useState<StreamChatMsg[]>([]);
  const [text, setText] = useState("");
  const [syncPos, setSyncPos] = useState<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState<PartyParticipant[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [convs, setConvs] = useState<CBConvSummary[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try { const p = await api.partyState(code!); setParty(p); setParticipants(p.participants ?? []); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const isHost = party?.is_host;

  // Heartbeat presence + shared chat for everyone; guests also poll the host's position.
  useEffect(() => {
    if (!code) return;
    const beat = async () => {
      try {
        const pres = await api.partyPresence(code);
        setParticipants(pres.participants ?? []);
        setMessages(await api.partyChat(code));
        if (!isHost) {
          const p = await api.partyState(code);
          setSyncPos(p.position);
        }
      } catch { /* ignore */ }
    };
    beat();
    const t = setInterval(beat, 4000);
    return () => clearInterval(t);
  }, [code, isHost]);

  useEffect(() => { if (code) api.partyChat(code).then(setMessages).catch(() => {}); }, [code]);

  const copyCode = async () => {
    try { await Share.share({ message: `Join my Konphlux Watch Party! Open PictureShow → Watch Party and enter code ${code}` }); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const openInvite = async () => {
    setInviteOpen(true);
    try { const res = await api.cbConversations(); setConvs(res.conversations); } catch { /* ignore */ }
  };

  const inviteTo = async (conv: CBConvSummary) => {
    if (invitedIds.includes(conv.id)) return;
    setInvitedIds((p) => [...p, conv.id]);
    try {
      await api.cbSend(conv.id, `🎬 Join my Watch Party — we're watching "${party.video_title}"! Open PictureShow → Watch Party and enter code ${code}`);
    } catch { setInvitedIds((p) => p.filter((x) => x !== conv.id)); }
  };

  const send = async () => {
    const b = text.trim();
    if (!b || !code) return;
    setText("");
    try { const m = await api.partyChatPost(code, b); setMessages((p) => [...p, m]); } catch { setText(b); }
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Joining the party…" /></View>;
  if (status === "error" || !party) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="party-back" style={[styles.roundBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <VideoPlayer
        uri={party.video_url}
        style={{ borderRadius: 0 }}
        onProgress={isHost ? (pos, _dur) => { api.partySync(code!, pos, true).catch(() => {}); } : undefined}
        syncPosition={isHost ? undefined : syncPos}
      />

      <View style={styles.meta}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{party.video_title}</Text>
          <Text style={[styles.host, { color: colors.muted }]}>{isHost ? "You're hosting" : `Hosted by ${party.host_name}`} · in sync</Text>
        </View>
        <Pressable onPress={copyCode} testID="party-code" style={[styles.codeChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
          <MaterialCommunityIcons name={copied ? "check" : "share-variant"} size={14} color={colors.brand} />
          <Text style={[styles.codeText, { color: colors.brand }]}>{copied ? "Copied" : party.code}</Text>
        </Pressable>
      </View>

      <View style={[styles.presence, { borderBottomColor: colors.border }]}>
        <View style={styles.avatarRow}>
          {participants.slice(0, 6).map((p, i) => (
            <View key={p.user_id} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -10, borderColor: colors.surface }]}>
              <AvatarInitials name={p.name} size={30} />
              {p.is_host ? <View style={[styles.hostDot, { backgroundColor: colors.brand, borderColor: colors.surface }]}><MaterialCommunityIcons name="crown" size={8} color={colors.onBrandPrimary} /></View> : null}
            </View>
          ))}
        </View>
        <Text style={[styles.presenceText, { color: colors.muted }]} testID="party-presence">
          {participants.length > 0 ? `${participants.length} ${participants.length === 1 ? "person" : "people"} watching` : "Waiting for others…"}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={openInvite} testID="party-invite" style={[styles.inviteBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="account-plus" size={15} color={colors.onBrandPrimary} />
          <Text style={[styles.inviteText, { color: colors.onBrandPrimary }]}>Invite</Text>
        </Pressable>
      </View>

      <View style={[styles.chat, { borderTopColor: colors.border }]}>
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
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>Share the code and chat while you watch together.</Text>}
        />
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
          <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
            <TextInput value={text} onChangeText={setText} placeholder="Chat with the party…" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="party-input" onSubmitEditing={send} returnKeyType="send" />
            <Pressable onPress={send} disabled={!text.trim()} style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]} testID="party-send">
              <MaterialCommunityIcons name="send" size={17} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
            </Pressable>
          </View>
        </KeyboardStickyView>
      </View>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={[styles.inviteSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.inviteSheetTitle, { color: colors.onSurface }]}>Invite friends</Text>
            <Text style={[styles.inviteSheetSub, { color: colors.muted }]}>Send the party code to a chat</Text>
            <FlatList
              data={convs}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const invited = invitedIds.includes(item.id);
                return (
                  <Pressable testID={`invite-${item.id}`} onPress={() => inviteTo(item)} disabled={invited} style={[styles.convRow, { borderBottomColor: colors.border }]}>
                    <MaterialCommunityIcons name={item.type === "group" ? "account-group" : "account"} size={20} color={colors.brand} />
                    <Text numberOfLines={1} style={[styles.convName, { color: colors.onSurface }]}>{item.title}</Text>
                    {invited ? (
                      <View style={[styles.invitedChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <MaterialCommunityIcons name="check" size={13} color="#27AE60" />
                        <Text style={[styles.invitedText, { color: "#27AE60" }]}>Invited</Text>
                      </View>
                    ) : (
                      <MaterialCommunityIcons name="send" size={17} color={colors.muted} />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No conversations yet. Start a chat in Chatterbox first.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.md },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 22 },
  host: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  codeChip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  codeText: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1 },
  presence: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { borderRadius: 17, borderWidth: 2, position: "relative" },
  hostDot: { position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  presenceText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  inviteText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  inviteSheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  inviteSheetTitle: { fontFamily: fonts.display, fontSize: 20 },
  inviteSheetSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 2, marginBottom: spacing.md },
  convRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  convName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
  invitedChip: { flexDirection: "row", alignItems: "center", gap: 3, height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  invitedText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  chat: { flex: 1, borderTopWidth: 1 },
  msgRow: { flexDirection: "row", flexWrap: "wrap" },
  msgAuthor: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  msgBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, flexShrink: 1 },
  empty: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
