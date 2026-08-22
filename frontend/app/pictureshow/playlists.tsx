import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSPlaylistCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSPlaylists() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [playlists, setPlaylists] = useState<PSPlaylistCard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setPlaylists(await api.psPlaylists());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (newTitle.trim().length < 2) return;
    setCreating(true);
    try {
      await api.psCreatePlaylist(newTitle.trim());
      setNewTitle("");
      setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psplaylists-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Playlists</Text>
          <Eyebrow>Curate your reels</Eyebrow>
        </View>
        <Pressable testID="psplaylist-new" onPress={() => setShowCreate(true)} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`psplaylist-${item.id}`} onPress={() => router.push(`/pictureshow/playlist/${item.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.thumbWrap, { backgroundColor: colors.surfaceTertiary }]}>
              {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumb} contentFit="cover" /> : <MaterialCommunityIcons name="playlist-play" size={28} color={colors.brand} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.count, { color: colors.muted }]}>{item.count} videos{item.mine ? "" : " · curated"}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={status === "loading" ? <Loading label="Loading playlists…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="playlist-music" title="No playlists yet" subtitle="Tap + to create your first playlist." />}
      />

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>New playlist</Text>
            <TextInput testID="playlist-title-input" value={newTitle} onChangeText={setNewTitle} placeholder="Playlist name" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
            <ForgeButton label="Create" fullWidth loading={creating} onPress={create} testID="playlist-create" style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  thumbWrap: { width: 72, height: 48, borderRadius: radius.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumb: { width: "100%", height: "100%" },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  count: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
});
