import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
        if (res.messages.length) setMessages((m) => [...m, ...res.messages]);
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
      const res = await api.cbPoll(id, optimistic.created_at);
      if (res.messages.length) setMessages((m) => [...m, ...res.messages]);
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const startCall = (mode: "voice" | "video") => {
    router.push({ pathname: "/chatterbox/call", params: { name: conv?.title ?? "", avatar: conv?.avatar ?? "", mode } });
  };

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
      </View>

      {loading ? (
        <Loading label="Loading conversation…" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => `${m.id}-${i}`}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollEnd}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.sender_id === conv?.me;
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
});
