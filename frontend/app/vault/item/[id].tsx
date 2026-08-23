import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, VaultItem } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function VaultItemDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try { setStatus("loading"); setItem(await api.vaultGetItem(id!)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () => {
    Alert.alert("Remove from Vault?", "This item will be deleted.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.vaultDeleteItem(id!); router.back(); } catch { /* ignore */ } } },
    ]);
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening…" /></View>;
  if (status === "error" || !item) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  // Seeded/source items (with a route) aren't user-editable.
  const editable = item.ref_id.startsWith("idea-");

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vi-back"><MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={styles.topActions}>
          {editable ? (
            <Pressable onPress={() => router.push(`/vault/add?id=${item.id}`)} hitSlop={10} testID="vi-edit"><MaterialCommunityIcons name="pencil-outline" size={21} color={colors.onSurface} /></Pressable>
          ) : null}
          <Pressable onPress={remove} hitSlop={10} testID="vi-delete"><MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.error ?? colors.muted} /></Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.hero} contentFit="cover" transition={180} /> : null}
        {item.category ? (
          <View style={[styles.catBadge, { backgroundColor: colors.surfaceTertiary, marginTop: item.image_url ? spacing.lg : 0 }]}>
            <Text style={[styles.catText, { color: colors.brand }]}>{item.category}</Text>
          </View>
        ) : null}
        <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>

        {item.text ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Instructions</Text>
            <Text style={[styles.body, { color: colors.onSurface }]}>{item.text}</Text>
          </>
        ) : null}
        {item.notes ? (
          <View style={[styles.notesBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.notesHead}><MaterialCommunityIcons name="note-text-outline" size={16} color={colors.brand} /><Text style={[styles.notesLabel, { color: colors.brand }]}>Notes</Text></View>
            <Text style={[styles.body, { color: colors.onSurface }]}>{item.notes}</Text>
          </View>
        ) : null}
        {!item.text && !item.notes && item.route ? (
          <Pressable onPress={() => router.push(item.route as any)} style={[styles.openSource, { borderColor: colors.brand }]} testID="vi-open-source">
            <MaterialCommunityIcons name="open-in-new" size={18} color={colors.brand} />
            <Text style={[styles.openSourceText, { color: colors.brand }]}>Open original</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  hero: { width: "100%", height: 240, borderRadius: radius.md },
  catBadge: { alignSelf: "flex-start", height: 24, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center" },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  notesBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  notesHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  notesLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.3 },
  openSource: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1.5, marginTop: spacing.lg },
  openSourceText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
});
