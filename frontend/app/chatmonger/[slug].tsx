import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ChatMessage } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function Bubble({ msg, monger }: { msg: ChatMessage; monger: string }) {
  const { colors } = useTheme();
  const mine = msg.role === "user";
  return (
    <View style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
      {!mine ? <AvatarInitials name={monger} size={32} style={{ marginRight: 8 }} /> : null}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.brand, borderTopRightRadius: 4 }
            : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.bubbleText, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

export default function ChatmongerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [monger, setMonger] = useState<{ name: string; role: string; greeting: string } | null>(null);
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await api.chatHistory(slug);
      setMonger(res.chatmonger);
      setDistrict(res.district);
      setMessages(res.messages);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    const optimistic: ChatMessage = { role: "user", text: body, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setSending(true);
    scrollEnd();
    try {
      const reply = await api.chatSend(slug!, body);
      setMessages((m) => [...m, reply]);
      scrollEnd();
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "The aether coil sputtered — try that again.", created_at: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const greeting: ChatMessage | null = monger
    ? { role: "assistant", text: monger.greeting, created_at: "0" }
    : null;
  const data = greeting ? [greeting, ...messages] : messages;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="chat-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        {monger ? <AvatarInitials name={monger.name} size={40} /> : <View style={{ width: 40 }} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{monger?.name ?? "Chatmonger"}</Text>
          <Eyebrow>{monger ? `${monger.role} · ${district}` : "Loading"}</Eyebrow>
        </View>
        <MaterialCommunityIcons name="cog" size={20} color={colors.brand} />
      </View>

      {loading ? (
        <Loading label="Waking the Chatmonger…" />
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(m, i) => `${m.created_at}-${i}`}
          renderItem={({ item }) => <Bubble msg={item} monger={monger?.name ?? "?"} />}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollEnd}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
                <AvatarInitials name={monger?.name ?? "?"} size={32} style={{ marginRight: 8 }} />
                <View style={[styles.bubble, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}>
                  <ActivityIndicator size="small" color={colors.brand} />
                </View>
              </View>
            ) : null
          }
        />
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={`Ask ${monger?.name ?? "the Chatmonger"}…`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            testID="chat-send"
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}
          >
            <MaterialCommunityIcons name="send" size={20} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 16 },
  list: { padding: spacing.lg, gap: spacing.md },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end" },
  bubble: { maxWidth: "80%", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
