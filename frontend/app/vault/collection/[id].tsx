import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, VaultCollection, VaultItem } from "@/src/api/client";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { VaultTile } from "@/app/vault/index";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

export default function VaultCollectionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [coll, setColl] = useState<VaultCollection | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [its, colls] = await Promise.all([api.vaultItems("", id!), api.vaultCollections()]);
      setItems(its); setColl(colls.find((c) => c.id === id) || null); setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (item: VaultItem) => {
    Alert.alert(item.title, item.subtitle || "Saved item", [
      { text: "Remove from this collection", onPress: async () => { try { await api.vaultMoveItem(item.id, null); load(); } catch { /* ignore */ } } },
      { text: "Delete from Vault", style: "destructive", onPress: async () => { try { await api.vaultDeleteItem(item.id); load(); } catch { /* ignore */ } } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const deleteCollection = () => {
    Alert.alert("Delete collection?", "The board will be removed. Its items stay in your Vault.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.vaultDeleteCollection(id!); router.back(); } catch { /* ignore */ } } },
    ]);
  };

  const cols: VaultItem[][] = [[], []];
  items.forEach((it, i) => cols[i % 2].push(it));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vc-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{coll?.name || "Collection"}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>{items.length} item{items.length !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable onPress={deleteCollection} hitSlop={10} testID="vc-delete">
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>

      {status === "loading" ? <Loading label="Opening collection…" /> :
       status === "error" ? <ErrorState onRetry={load} /> :
       items.length === 0 ? <EmptyState icon="folder-open-outline" title="Nothing here yet" subtitle="Long-press any saved item in the Vault and add it to this collection." /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.md }} showsVerticalScrollIndicator={false}>
          <View style={styles.masonry}>
            {cols.map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map((it) => <VaultTile key={it.id} item={it} colors={colors} onPress={() => it.route ? router.push(it.route as any) : remove(it)} onLong={() => remove(it)} />)}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  sub: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  masonry: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  col: { flex: 1, gap: spacing.md },
});
