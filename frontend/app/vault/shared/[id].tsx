import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, VaultItem } from "@/src/api/client";
import { VaultTile } from "@/app/vault/index";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

export default function SharedBoard() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [meta, setMeta] = useState<{ board_name: string; owner_name: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.vaultSharedDetail(id!);
      setItems(res.items); setMeta({ board_name: res.board_name, owner_name: res.owner_name }); setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openItem = (item: VaultItem) => {
    if (item.route) router.push(item.route as any);
    else router.push(`/vault/item/${item.id}`);
  };

  const cols: VaultItem[][] = [[], []];
  items.forEach((it, i) => cols[i % 2].push(it));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vs-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{meta?.board_name || "Shared board"}</Text>
          <Eyebrow>Shared by {meta?.owner_name || "a friend"} · view only</Eyebrow>
        </View>
      </View>

      {status === "loading" ? <Loading label="Opening the board…" /> :
       status === "error" ? <ErrorState onRetry={load} /> :
       items.length === 0 ? <EmptyState icon="folder-open-outline" title="This board is empty" subtitle="Nothing has been added to it yet." /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.md }} showsVerticalScrollIndicator={false}>
          <View style={styles.masonry}>
            {cols.map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map((it) => <VaultTile key={it.id} item={it} colors={colors} onPress={() => openItem(it)} onLong={() => openItem(it)} />)}
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
  masonry: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  col: { flex: 1, gap: spacing.md },
});
