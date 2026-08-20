import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Booth } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function Booths() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Booth[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setItems(await api.listBooths());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: Booth }) => (
    <Pressable
      testID={`booth-${item.id}`}
      onPress={() => router.push(`/bazaar/booth/${item.id}`)}
      style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceTertiary }]}>
          <MaterialCommunityIcons name="storefront" size={26} color={colors.brand} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.name}</Text>
        <Text numberOfLines={1} style={[styles.owner, { color: colors.muted }]}>by {item.owner_name}</Text>
        <Text style={[styles.count, { color: colors.brand }]}>{compactNumber(item.listing_count)} items</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="booths-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Booths</Text>
          <Eyebrow>Seller storefronts</Eyebrow>
        </View>
        <Pressable testID="new-booth-btn" onPress={() => router.push("/bazaar/new-booth")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="store-plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Opening the arcade…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xxl }}>
              <EmptyState icon="storefront-outline" title="No booths yet" subtitle="Set up a booth to group your wares into a storefront." />
              <ForgeButton label="Set up a booth" onPress={() => router.push("/bazaar/new-booth")} testID="booths-empty-create" style={{ alignSelf: "center", marginTop: spacing.lg }} icon={<MaterialCommunityIcons name="store-plus" size={16} color={colors.onBrandPrimary} />} />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  thumb: { width: 60, height: 60, borderRadius: radius.sm },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.displaySemi, fontSize: 16 },
  owner: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  count: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 3 },
});
