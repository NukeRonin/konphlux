import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Turn = { role: "user" | "assistant"; content: string };

const OPENERS = [
  "Step off the airship into the fog",
  "Explore the abandoned clock tower",
  "Follow the trail of steam",
];

export default function AIventure() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Turn>>(null);

  const send = async (action: string) => {
    const act = action.trim();
    if (!act || busy) return;
    setText("");
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: act }]);
    setBusy(true);
    try {
      const res = await api.anvilAdventure(history, act);
      setTurns((prev) => [...prev, { role: "assistant", content: res.text }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", content: "The aether flickered — try that again." }]);
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }: { item: Turn }) => {
    const mine = item.role === "user";
    return (
      <View style={[styles.bubbleWrap, { alignItems: mine ? "flex-end" : "flex-start" }]}>
        {!mine ? <Text style={[styles.narrator, { color: colors.brandSecondary }]}>NARRATOR</Text> : null}
        <View style={[styles.bubble, mine ? { backgroundColor: colors.brand } : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.bubbleText, { color: mine ? colors.onBrandPrimary : colors.onSurface }]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="aiventure-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>AIventure</Text>
          <Eyebrow>An interactive tale</Eyebrow>
        </View>
        {turns.length > 0 ? (
          <Pressable testID="aiventure-restart" onPress={() => setTurns([])} hitSlop={10}>
            <MaterialCommunityIcons name="restart" size={22} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>

      {turns.length === 0 ? (
        <View style={styles.intro}>
          <MaterialCommunityIcons name="compass-rose" size={54} color={colors.brand} />
          <Text style={[styles.introTitle, { color: colors.onSurface }]}>Begin your adventure</Text>
          <Text style={[styles.introSub, { color: colors.muted }]}>Type an action, or pick a way to start:</Text>
          <View style={styles.openers}>
            {OPENERS.map((o) => (
              <Pressable key={o} testID={`opener-${o}`} onPress={() => send(o)} style={[styles.opener, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.openerText, { color: colors.onSurface }]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={busy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} /> : null}
        />
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="aiventure-input"
            value={text}
            onChangeText={setText}
            placeholder="What do you do?"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
            onSubmitEditing={() => send(text)}
          />
          <Pressable testID="aiventure-send" onPress={() => send(text)} disabled={!text.trim() || busy} style={[styles.send, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]}>
            <MaterialCommunityIcons name="send" size={18} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  introTitle: { fontFamily: fonts.display, fontSize: 22, marginTop: spacing.md },
  introSub: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
  openers: { marginTop: spacing.lg, gap: spacing.sm, alignSelf: "stretch" },
  opener: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  openerText: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  list: { padding: spacing.lg, gap: spacing.md },
  bubbleWrap: { marginBottom: spacing.sm },
  narrator: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, marginBottom: 3 },
  bubble: { maxWidth: "88%", borderRadius: radius.md, padding: spacing.md },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
