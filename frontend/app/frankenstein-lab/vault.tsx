import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl, FrankVaultItem } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "pic", label: "Pics" },
  { key: "logo", label: "Logos" },
  { key: "gif", label: "GIFs" },
  { key: "meme", label: "Memes" },
  { key: "music", label: "Music" },
  { key: "sfx", label: "SFX" },
];

const KIND_ICON: Record<string, IconName> = {
  pic: "image", logo: "shield-star", gif: "animation-play", meme: "emoticon-lol", music: "music-clef-treble", sfx: "waveform",
};

export default function Vault() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<FrankVaultItem[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setItems(await api.frankVault(filter || undefined));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (item: FrankVaultItem) => {
    Alert.alert("Remove from Vault?", "This creation will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { try { await api.frankVaultDelete(item.id); load(); } catch { /* ignore */ } } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vault-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>My Vault</Text>
          <Eyebrow>Your private creations</Eyebrow>
        </View>
        <MaterialCommunityIcons name="treasure-chest" size={22} color={colors.brand} />
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key || "all"}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <Pressable testID={`vault-filter-${item.key || "all"}`} onPress={() => setFilter(item.key)} style={[styles.filterChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.filterText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.image_path ? (
              <Image source={{ uri: fileUrl(item.image_path) }} style={styles.cardImg} contentFit="cover" />
            ) : (
              <View style={[styles.cardImg, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
                <MaterialCommunityIcons name={KIND_ICON[item.kind] ?? "shape"} size={30} color={colors.brand} />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={[styles.kindBadge, { backgroundColor: colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name={KIND_ICON[item.kind] ?? "shape"} size={11} color={colors.brand} />
                <Text style={[styles.kindText, { color: colors.brand }]}>{item.kind.toUpperCase()}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Pressable testID={`vault-delete-${item.id}`} onPress={() => confirmDelete(item)} hitSlop={6} style={styles.del}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.error ?? colors.muted} />
                <Text style={[styles.delText, { color: colors.error ?? colors.muted }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Opening the vault…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="treasure-chest" title="Your Vault is empty" subtitle="Generate something in the studios and tap 'Save to Vault'." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  filterChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  grid: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { flex: 1, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cardImg: { width: "100%", height: 130 },
  cardBody: { padding: spacing.sm, gap: 6 },
  kindBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, height: 20, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  kindText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  cardTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17 },
  del: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  delText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
