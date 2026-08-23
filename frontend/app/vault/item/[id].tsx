import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, VaultCollection, VaultItem } from "@/src/api/client";
import { AudioPreview } from "@/src/components/AudioPreview";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { downloadAndShare } from "@/src/utils/mediaDownload";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
// Contextual deep-links for Knowledge & Travel items.
const DEEP_LINK: Record<string, { label: string; icon: IconName }> = {
  "Travel Ideas": { label: "Explore in Waypoint", icon: "map-marker-radius" },
  "Tutorials": { label: "Learn in BrainBoost", icon: "school" },
};

export default function VaultItemDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [collections, setCollections] = useState<VaultCollection[]>([]);
  const [shared, setShared] = useState<{ collection_id: string; board_name: string; owner_name: string }[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [boardModal, setBoardModal] = useState(false);
  const [newBoard, setNewBoard] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [it, colls, shd] = await Promise.all([api.vaultGetItem(id!), api.vaultCollections(), api.vaultShared()]);
      setItem(it); setCollections(colls); setShared(shd); setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () => {
    Alert.alert("Remove from Vault?", "This item will be deleted.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.vaultDeleteItem(id!); router.back(); } catch { /* ignore */ } } },
    ]);
  };

  const addToBoard = () => {
    if (!item) return;
    const buttons: any[] = collections.map((c) => ({
      text: item.collection_id === c.id ? `✓ ${c.name}` : c.name,
      onPress: async () => { try { await api.vaultMoveItem(item.id, c.id); load(); } catch { /* ignore */ } },
    }));
    if (item.collection_id) buttons.push({ text: "Remove from board", onPress: async () => { try { await api.vaultMoveItem(item.id, null); load(); } catch { /* ignore */ } } });
    shared.forEach((s) => buttons.push({
      text: `${s.board_name} (shared by ${s.owner_name})`,
      onPress: async () => { try { await api.vaultMoveItem(item.id, s.collection_id); load(); } catch { /* ignore */ } },
    }));
    buttons.push({ text: "New board…", onPress: () => setBoardModal(true) });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Add to a board", item.title, buttons);
  };

  const createBoard = async () => {
    const name = newBoard.trim();
    if (!name || !item) return;
    try {
      const coll = await api.vaultCreateCollection(name);
      await api.vaultMoveItem(item.id, coll.id);
      setNewBoard(""); setBoardModal(false); load();
    } catch { /* ignore */ }
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening…" /></View>;
  if (status === "error" || !item) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  // Seeded/source items (with a route) aren't user-editable.
  const editable = item.ref_id.startsWith("idea-");
  const deep = item.route ? (DEEP_LINK[item.category] ?? { label: "Open original", icon: "open-in-new" as IconName }) : null;
  const board = collections.find((c) => c.id === item.collection_id);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vi-back"><MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={styles.topActions}>
          {item.media_url ? (
            <Pressable onPress={() => downloadAndShare(item.media_url, `${item.title || "creation"}.${item.media_type === "video" ? "mp4" : "wav"}`)} hitSlop={10} testID="vi-download"><MaterialCommunityIcons name="download" size={21} color={colors.onSurface} /></Pressable>
          ) : null}
          <Pressable onPress={addToBoard} hitSlop={10} testID="vi-add-board"><MaterialCommunityIcons name="folder-plus-outline" size={21} color={colors.onSurface} /></Pressable>
          {editable ? (
            <Pressable onPress={() => router.push(`/vault/add?id=${item.id}`)} hitSlop={10} testID="vi-edit"><MaterialCommunityIcons name="pencil-outline" size={21} color={colors.onSurface} /></Pressable>
          ) : null}
          <Pressable onPress={remove} hitSlop={10} testID="vi-delete"><MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.error ?? colors.muted} /></Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.hero} contentFit="cover" transition={180} /> : null}
        {item.media_url && item.media_type === "video" ? (
          <View style={{ marginTop: spacing.md }}><VideoPlayer uri={item.media_url} loop style={{ aspectRatio: 1 }} /></View>
        ) : null}
        {item.media_url && item.media_type === "audio" ? (
          <View style={{ marginTop: spacing.md }}><AudioPreview uri={item.media_url} title={item.title} /></View>
        ) : null}
        <View style={[styles.badgeRow, { marginTop: item.image_url ? spacing.lg : 0 }]}>
          {item.category ? (
            <View style={[styles.catBadge, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.catText, { color: colors.brand }]}>{item.category}</Text>
            </View>
          ) : null}
          {board ? (
            <Pressable onPress={() => router.push(`/vault/collection/${board.id}`)} style={[styles.boardBadge, { borderColor: colors.border }]} testID="vi-board-chip">
              <MaterialCommunityIcons name="folder-multiple-image" size={12} color={colors.muted} />
              <Text style={[styles.boardText, { color: colors.muted }]}>{board.name}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>

        {deep ? (
          <Pressable onPress={() => router.push(item.route as any)} style={[styles.openSource, { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary }]} testID="vi-open-source">
            <MaterialCommunityIcons name={deep.icon} size={18} color={colors.brand} />
            <Text style={[styles.openSourceText, { color: colors.brand }]}>{deep.label}</Text>
          </Pressable>
        ) : null}

        {item.text ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{item.category === "Reading List" ? "About" : "Instructions"}</Text>
            <Text style={[styles.body, { color: colors.onSurface }]}>{item.text}</Text>
          </>
        ) : null}
        {item.notes ? (
          <View style={[styles.notesBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.notesHead}><MaterialCommunityIcons name="note-text-outline" size={16} color={colors.brand} /><Text style={[styles.notesLabel, { color: colors.brand }]}>Notes</Text></View>
            <Text style={[styles.body, { color: colors.onSurface }]}>{item.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={boardModal} transparent animationType="fade" onRequestClose={() => setBoardModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBoardModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>New board</Text>
            <TextInput value={newBoard} onChangeText={setNewBoard} autoFocus placeholder="e.g. Dream getaways" placeholderTextColor={colors.muted} style={[styles.sheetInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="vi-board-name" />
            <View style={styles.sheetRow}>
              <Pressable onPress={() => setBoardModal(false)} hitSlop={8}><Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text></Pressable>
              <Pressable onPress={createBoard} disabled={!newBoard.trim()} style={[styles.createBtn, { backgroundColor: newBoard.trim() ? colors.brand : colors.surfaceTertiary }]} testID="vi-board-create">
                <Text style={[styles.createText, { color: newBoard.trim() ? colors.onBrandPrimary : colors.muted }]}>Create & add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  hero: { width: "100%", height: 240, borderRadius: radius.md },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  catBadge: { alignSelf: "flex-start", height: 24, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center" },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
  boardBadge: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  boardText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  notesBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  notesHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  notesLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.3 },
  openSource: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1.5, marginTop: spacing.lg },
  openSourceText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.displaySemi, fontSize: 19, marginBottom: spacing.md },
  sheetInput: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg },
  cancel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  createBtn: { height: 40, minWidth: 96, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  createText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
