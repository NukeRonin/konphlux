import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, EventionList } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ListsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<EventionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try { setLists(await api.eventionLists()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const l = await api.eventionCreateList(title.trim());
      setTitle("");
      await load();
      router.push(`/evention/list/${l.id}`);
    } catch { Alert.alert("Couldn't create", "Try again."); } finally { setCreating(false); }
  };

  const remove = (l: EventionList) => {
    Alert.alert("Delete list", `Remove "${l.title}" and all its items?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.eventionDeleteList(l.id); load(); } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="lists-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Lists</Text>
          <Eyebrow>Evention Center</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.createRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <TextInput
            value={title} onChangeText={setTitle} placeholder="New checklist (e.g. Packing list)"
            placeholderTextColor={colors.muted} style={[styles.createInput, { color: colors.onSurface }]}
            returnKeyType="done" onSubmitEditing={create} testID="lists-new-title"
          />
          <Pressable onPress={create} disabled={!title.trim()} style={[styles.createBtn, { backgroundColor: title.trim() ? colors.brand : colors.surfaceTertiary }]} testID="lists-create">
            <MaterialCommunityIcons name="plus" size={20} color={title.trim() ? colors.onBrandPrimary : colors.muted} />
          </Pressable>
        </View>

        {loading ? (
          <Loading label="Loading your lists…" />
        ) : lists.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="format-list-checks" size={40} color={colors.muted} />
            <Text style={[styles.empty, { color: colors.muted }]}>No lists yet. Create a packing list, a to-do list, or anything you like.</Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {lists.map((l) => {
              const total = l.items.length;
              const done = l.items.filter((i) => i.done).length;
              return (
                <Pressable key={l.id} onPress={() => router.push(`/evention/list/${l.id}`)} onLongPress={() => remove(l)}
                  style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`list-card-${l.id}`}>
                  <View style={[styles.cardIcon, { backgroundColor: `${colors.brand}22` }]}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>{l.title}</Text>
                    <Text style={[styles.cardMeta, { color: colors.muted }]}>{total === 0 ? "Empty" : `${done}/${total} done`}</Text>
                  </View>
                  <Pressable onPress={() => remove(l)} hitSlop={10} testID={`list-del-${l.id}`}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  createRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: spacing.xs },
  createInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, minHeight: 44 },
  createBtn: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  cardMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
