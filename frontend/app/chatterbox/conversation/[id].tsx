import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CBConvDetail, CBMessage } from "@/src/api/client";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [conv, setConv] = useState<CBConvDetail | null>(null);
  const [messages, setMessages] = useState<CBMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<"" | "offer" | "interview">("");
  const [fTitle, setFTitle] = useState("");
  const [fRate, setFRate] = useState("");
  const [fNote, setFNote] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fLoc, setFLoc] = useState("");

  // Merge helper: append only messages we don't already have (dedupe by id).
  const mergeMessages = (prev: CBMessage[], incoming: CBMessage[]) => {
    const seen = new Set(prev.map((m) => m.id));
    const add = incoming.filter((m) => !seen.has(m.id));
    return add.length ? [...prev, ...add] : prev;
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.cbConversation(id);
      setConv(res);
      setMessages(res.messages);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages.
  useEffect(() => {
    if (!id) return;
    const t = setInterval(async () => {
      const last = messages.length ? messages[messages.length - 1].created_at : "";
      try {
        const res = await api.cbPoll(id, last);
        if (res.messages.length) setMessages((m) => mergeMessages(m, res.messages));
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [id, messages]);

  const scrollEnd = () => listRef.current?.scrollToEnd({ animated: true });

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !id) return;
    setText("");
    setSending(true);
    const optimistic: CBMessage = { id: `tmp-${Date.now()}`, conversation_id: id, sender_id: conv?.me ?? "me", sender_name: "You", text: t, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      await api.cbSend(id, t);
      // Replace the optimistic bubble with the canonical server state (real message + any auto-reply).
      const res = await api.cbConversation(id);
      setConv(res);
      setMessages(res.messages);
    } catch {
      // Roll back the optimistic bubble and restore the text so nothing is lost.
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const startCall = (mode: "voice" | "video") => {
    router.push({ pathname: "/chatterbox/call", params: { name: conv?.title ?? "", avatar: conv?.avatar ?? "", mode } });
  };

  const reload = async () => {
    if (!id) return;
    const res = await api.cbConversation(id);
    setConv(res);
    setMessages(res.messages);
  };

  const submitSheet = async () => {
    if (!id || !conv?.other_id || !fTitle.trim()) return;
    try {
      if (sheet === "offer") {
        await api.sendOffer({ conversation_id: id, to_user_id: conv.other_id, title: fTitle.trim(), rate_text: fRate.trim(), note: fNote.trim() });
      } else {
        if (!fWhen) { Alert.alert("Pick a time", "Choose a proposed time for the interview."); return; }
        await api.scheduleInterview({ to_user_id: conv.other_id, conversation_id: id, title: fTitle.trim(), scheduled_at: fWhen, location: fLoc.trim() });
      }
      setSheet(""); setFTitle(""); setFRate(""); setFNote(""); setFWhen(""); setFLoc("");
      await reload();
    } catch (e: any) {
      Alert.alert("Couldn't send", e?.message || "Try again.");
    }
  };

  const respondOffer = async (offerId: string, accept: boolean) => {
    try { await api.respondOffer(offerId, accept); await reload(); } catch { Alert.alert("Couldn't respond", "Try again."); }
  };
  const respondInterview = async (ivId: string, status: "confirmed" | "declined") => {
    try { await api.respondInterview(ivId, status); await reload(); } catch { Alert.alert("Couldn't respond", "Try again."); }
  };

  // Quick time-slot options for interview proposals.
  const slots: { label: string; iso: string }[] = (() => {
    const out: { label: string; iso: string }[] = [];
    for (const [dLabel, days] of [["Tomorrow", 1], ["In 2 days", 2], ["Next week", 7]] as [string, number][]) {
      for (const h of [10, 14]) {
        const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0);
        out.push({ label: `${dLabel} ${h}:00`, iso: d.toISOString() });
      }
    }
    return out;
  })();

  const isDM = conv?.type !== "group" && !!conv?.other_id;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="conv-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        {conv ? <Image source={{ uri: conv.avatar }} style={styles.headerAvatar} contentFit="cover" /> : <View style={{ width: 38 }} />}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{conv?.title ?? "Conversation"}</Text>
          <Text numberOfLines={1} style={[styles.sub, { color: colors.muted }]}>
            {conv?.type === "group" ? `${conv.member_count} members` : "Direct message"}
          </Text>
        </View>
        <Pressable testID="conv-voice" onPress={() => startCall("voice")} hitSlop={8} style={styles.callBtn}>
          <MaterialCommunityIcons name="phone" size={20} color={colors.brand} />
        </Pressable>
        <Pressable testID="conv-video" onPress={() => startCall("video")} hitSlop={8} style={styles.callBtn}>
          <MaterialCommunityIcons name="video" size={22} color={colors.brand} />
        </Pressable>
        {isDM ? (
          <Pressable testID="conv-actions" onPress={() => Alert.alert("Send to " + (conv?.title ?? ""), undefined, [
            { text: "Send an offer", onPress: () => setSheet("offer") },
            { text: "Schedule an interview", onPress: () => setSheet("interview") },
            { text: "Cancel", style: "cancel" },
          ])} hitSlop={8} style={styles.callBtn}>
            <MaterialCommunityIcons name="briefcase-plus" size={22} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Loading label="Loading conversation…" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollEnd}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.sender_id === conv?.me;
            const meta = item.meta || {};
            if (item.kind === "system") {
              return <Text style={[styles.systemMsg, { color: colors.muted }]}>{item.text}</Text>;
            }
            if (item.kind === "offer" || item.kind === "interview") {
              const isOffer = item.kind === "offer";
              const canRespond = !mine && meta.status === (isOffer ? "pending" : "proposed");
              return (
                <View style={[styles.cardMsg, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
                  <View style={styles.cardHead}>
                    <MaterialCommunityIcons name={isOffer ? "handshake" : "calendar-clock"} size={16} color={colors.brand} />
                    <Text style={[styles.cardKind, { color: colors.brand }]}>{isOffer ? "OFFER" : "INTERVIEW"}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.cardStatus, { color: colors.muted }]}>{String(meta.status || "").toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{meta.title || item.text}</Text>
                  {isOffer && meta.rate_text ? <Text style={[styles.cardLine, { color: colors.onSurface }]}>Rate: {meta.rate_text}</Text> : null}
                  {isOffer && meta.note ? <Text style={[styles.cardLine, { color: colors.muted }]}>{meta.note}</Text> : null}
                  {!isOffer && meta.scheduled_at ? <Text style={[styles.cardLine, { color: colors.onSurface }]}>{new Date(meta.scheduled_at).toLocaleString()}</Text> : null}
                  {!isOffer && meta.location ? <Text style={[styles.cardLine, { color: colors.muted }]}>{meta.location}</Text> : null}
                  {canRespond ? (
                    <View style={styles.cardBtns}>
                      <Pressable onPress={() => isOffer ? respondOffer(meta.offer_id, true) : respondInterview(meta.interview_id, "confirmed")} style={[styles.cardBtn, { backgroundColor: colors.brand }]}>
                        <Text style={[styles.cardBtnText, { color: colors.onBrandPrimary }]}>{isOffer ? "Accept" : "Confirm"}</Text>
                      </Pressable>
                      <Pressable onPress={() => isOffer ? respondOffer(meta.offer_id, false) : respondInterview(meta.interview_id, "declined")} style={[styles.cardBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                        <Text style={[styles.cardBtnText, { color: colors.onSurface }]}>Decline</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            }
            return (
              <View style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                <View style={[styles.bubble, mine ? { backgroundColor: colors.brand, borderTopRightRadius: 4 } : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 }]}>
                  {!mine && conv?.type === "group" ? <Text style={[styles.sender, { color: colors.brand }]}>{item.sender_name}</Text> : null}
                  <Text style={[styles.bubbleText, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>Say hello to start the conversation.</Text>}
        />
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput testID="conv-input" value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]} multiline />
          <Pressable onPress={send} disabled={!text.trim() || sending} testID="conv-send" style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}>
            <MaterialCommunityIcons name="send" size={20} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
          </Pressable>
        </View>
      </KeyboardStickyView>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet("")}>
        <Pressable style={styles.backdrop} onPress={() => setSheet("")}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>{sheet === "offer" ? "Send an offer" : "Propose an interview"}</Text>
            <TextInput value={fTitle} onChangeText={setFTitle} placeholder={sheet === "offer" ? "Role / offer title" : "Interview title"} placeholderTextColor={colors.muted} style={[styles.mInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sheet-title" />
            {sheet === "offer" ? (
              <>
                <TextInput value={fRate} onChangeText={setFRate} placeholder="Rate (e.g. $60/hr or $5,000 fixed)" placeholderTextColor={colors.muted} style={[styles.mInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sheet-rate" />
                <TextInput value={fNote} onChangeText={setFNote} placeholder="Note (scope, start date…)" placeholderTextColor={colors.muted} multiline style={[styles.mInput, styles.mMulti, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sheet-note" />
              </>
            ) : (
              <>
                <Text style={[styles.mLabel, { color: colors.onSurface }]}>Proposed time</Text>
                <View style={styles.slotWrap}>
                  {slots.map((s) => (
                    <Pressable key={s.iso} onPress={() => setFWhen(s.iso)} style={[styles.slot, { backgroundColor: fWhen === s.iso ? colors.brand : colors.surfaceSecondary, borderColor: fWhen === s.iso ? colors.brand : colors.border }]}>
                      <Text style={[styles.slotText, { color: fWhen === s.iso ? colors.onBrandPrimary : colors.onSurface }]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={fLoc} onChangeText={setFLoc} placeholder="Location or video link" placeholderTextColor={colors.muted} style={[styles.mInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sheet-loc" />
              </>
            )}
            <Pressable onPress={submitSheet} disabled={!fTitle.trim()} style={[styles.mSend, { backgroundColor: fTitle.trim() ? colors.brand : colors.surfaceTertiary }]} testID="sheet-send">
              <Text style={[styles.mSendText, { color: fTitle.trim() ? colors.onBrandPrimary : colors.muted }]}>{sheet === "offer" ? "Send offer" : "Send proposal"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  title: { fontFamily: fonts.displaySemi, fontSize: 16 },
  sub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  callBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "80%", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sender: { fontFamily: fonts.bodyBold, fontSize: 11, marginBottom: 2 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  empty: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.xxl },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  systemMsg: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginVertical: 4 },
  cardMsg: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 3 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardKind: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5 },
  cardStatus: { fontFamily: fonts.bodyBold, fontSize: 10 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  cardLine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  cardBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  cardBtn: { flex: 1, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: 4 },
  mInput: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  mMulti: { minHeight: 72, textAlignVertical: "top" },
  mLabel: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 4 },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  slotText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  mSend: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  mSendText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
