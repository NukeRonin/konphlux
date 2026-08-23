import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BoardMessage } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function BoardChat() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try { setStatus("loading"); const res = await api.vaultBoardMessages(id!); setMessages(res.messages); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText(""); setSending(true);
    try {
      const m = await api.vaultBoardPost(id!, body);
      setMessages((p) => [...p, m]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    } catch { setText(body); } finally { setSending(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="bc-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{name || "Board chat"}</Text>
          <Eyebrow>Plan together</Eyebrow>
        </View>
      </View>

      {status === "loading" ? <Loading label="Loading chat…" /> :
       status === "error" ? <ErrorState onRetry={load} /> : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.user_id === user?.id;
              return (
                <View style={[styles.row, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                  {!mine ? <AvatarInitials name={item.author} size={30} /> : null}
                  <View style={[styles.bubble, { backgroundColor: mine ? colors.brand : colors.surfaceSecondary, borderColor: colors.border }]}>
                    {!mine ? <Text style={[styles.author, { color: colors.brand }]}>{item.author}</Text> : null}
                    <Text style={[styles.body, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No messages yet — say hello and start planning.</Text>}
          />
          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
              <TextInput value={text} onChangeText={setText} placeholder="Message the board…" placeholderTextColor={colors.muted} multiline style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="bc-input" />
              <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]} testID="bc-send">
                <MaterialCommunityIcons name="send" size={18} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
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
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  bubble: { maxWidth: "78%", borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  author: { fontFamily: fonts.bodyBold, fontSize: 11.5, marginBottom: 2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  empty: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: spacing.xxl },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
