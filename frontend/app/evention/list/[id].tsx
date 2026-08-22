import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, EventionList } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ListDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [list, setList] = useState<EventionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api.eventionLists();
      setList(all.find((l) => l.id === id) || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addItem = async () => {
    if (!text.trim() || !id || adding) return;
    setAdding(true);
    const t = text.trim();
    setText("");
    try {
      const item = await api.eventionAddListItem(id, t);
      setList((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));
    } catch { Alert.alert("Couldn't add", "Try again."); } finally { setAdding(false); }
  };

  const toggle = async (itemId: string) => {
    if (!id) return;
    setList((prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } : prev));
    try { await api.eventionToggleListItem(id, itemId); } catch { load(); }
  };

  const removeItem = async (itemId: string) => {
    if (!id) return;
    setList((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev));
    try { await api.eventionDeleteListItem(id, itemId); } catch { load(); }
  };

  const done = list ? list.items.filter((i) => i.done).length : 0;
  const total = list ? list.items.length : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="list-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{list?.title || "List"}</Text>
          <Eyebrow>{total === 0 ? "Checklist" : `${done}/${total} done`}</Eyebrow>
        </View>
      </View>

      {loading ? (
        <Loading label="Loading…" />
      ) : !list ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.empty, { color: colors.muted }]}>This list no longer exists.</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <View style={[styles.addRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              value={text} onChangeText={setText} placeholder="Add an item" placeholderTextColor={colors.muted}
              style={[styles.addInput, { color: colors.onSurface }]} returnKeyType="done" onSubmitEditing={addItem}
              blurOnSubmit={false} testID="item-input"
            />
            <Pressable onPress={addItem} disabled={!text.trim()} style={[styles.addBtn, { backgroundColor: text.trim() ? colors.brand : colors.surfaceTertiary }]} testID="item-add">
              <MaterialCommunityIcons name="plus" size={20} color={text.trim() ? colors.onBrandPrimary : colors.muted} />
            </Pressable>
          </View>

          {list.items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="playlist-plus" size={38} color={colors.muted} />
              <Text style={[styles.empty, { color: colors.muted }]}>No items yet. Add your first one above.</Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {list.items.map((it) => (
                <View key={it.id} style={[styles.item, { borderBottomColor: colors.border }]}>
                  <Pressable onPress={() => toggle(it.id)} hitSlop={8} style={styles.check} testID={`item-toggle-${it.id}`}>
                    <MaterialCommunityIcons
                      name={it.done ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={24} color={it.done ? colors.brand : colors.muted}
                    />
                  </Pressable>
                  <Text style={[styles.itemText, { color: it.done ? colors.muted : colors.onSurface, textDecorationLine: it.done ? "line-through" : "none" }]}>{it.text}</Text>
                  <Pressable onPress={() => removeItem(it.id)} hitSlop={8} testID={`item-del-${it.id}`}>
                    <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.xs },
  addInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, minHeight: 44 },
  addBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  check: { paddingRight: 2 },
  itemText: { flex: 1, fontFamily: fonts.body, fontSize: 15.5, lineHeight: 21 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
