import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Listing } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

export default function MyListings() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Listing[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setItems(await api.getMyListings());
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

  const confirmDelete = (item: Listing) => {
    Alert.alert("Remove listing?", `"${item.title}" will be taken down.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setItems((prev) => prev.filter((x) => x.id !== item.id));
          try {
            await api.deleteListing(item.id);
          } catch {
            load();
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Listing }) => (
    <Pressable
      testID={`mine-${item.id}`}
      onPress={() => router.push(`/product/${item.id}`)}
      style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <Image source={{ uri: item.image }} style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <View style={[styles.tag, { backgroundColor: colors.surfaceTertiary }]}>
            <MaterialCommunityIcons name={item.is_auction ? "gavel" : "tag"} size={11} color={colors.brand} />
            <Text style={[styles.tagText, { color: colors.brand }]}>{item.is_auction ? (item.ended ? "Auction ended" : "Auction") : "Fixed"}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
        <Text style={[styles.price, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
        {item.is_auction ? (
          <Text style={[styles.meta, { color: colors.muted }]}>{item.bid_count ?? 0} bids</Text>
        ) : null}
      </View>
      <Pressable onPress={() => confirmDelete(item)} hitSlop={10} testID={`delete-${item.id}`} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.error} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="mine-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Your Posts</Text>
          <Eyebrow>Listings you're selling</Eyebrow>
        </View>
        <Pressable testID="mine-sell" onPress={() => router.push("/bazaar/sell")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="tag-plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Fetching your stall…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xxl }}>
              <EmptyState icon="storefront-outline" title="Nothing listed yet" subtitle="List your first item to open your booth." />
              <ForgeButton label="List an item" onPress={() => router.push("/bazaar/sell")} testID="mine-empty-sell" style={{ alignSelf: "center", marginTop: spacing.lg }} icon={<MaterialCommunityIcons name="tag-plus" size={16} color={colors.onBrandPrimary} />} />
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
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  rowTop: { flexDirection: "row" },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  title: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 3 },
  price: { fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  deleteBtn: { padding: spacing.sm },
});
