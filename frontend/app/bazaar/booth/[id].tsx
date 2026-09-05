import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Booth, Listing } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

export default function BoothDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [booth, setBooth] = useState<Booth | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setBooth(await api.boothDetail(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: Listing }) => (
    <Pressable
      testID={`booth-item-${item.id}`}
      onPress={() => router.push(`/product/${item.id}`)}
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View>
        <Image source={{ uri: item.image }} style={[styles.cardImg, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
        {item.is_auction ? (
          <View style={[styles.badge, { backgroundColor: item.ended ? colors.muted : colors.brandSecondary }]}>
            <MaterialCommunityIcons name="gavel" size={10} color={colors.onBrandPrimary} />
            <Text style={[styles.badgeText, { color: colors.onBrandPrimary }]}>{item.ended ? "ENDED" : "AUCTION"}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
        <Text style={[styles.cardPrice, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {status === "loading" ? (
        <>
          <View style={{ height: insets.top }} />
          <Loading label="Opening the booth…" />
        </>
      ) : status === "error" || !booth ? (
        <>
          <View style={{ height: insets.top }} />
          <ErrorState onRetry={load} />
        </>
      ) : (
        <FlatList
          data={booth.listings ?? []}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                {booth.banner || booth.image ? (
                  <Image source={{ uri: booth.banner || booth.image }} style={styles.heroImg} contentFit="cover" />
                ) : (
                  <View style={[styles.heroImg, styles.heroFallback, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="storefront" size={54} color={colors.brand} />
                  </View>
                )}
                <Pressable onPress={() => router.back()} hitSlop={12} testID="booth-back" style={[styles.backBtn, { top: insets.top + spacing.sm, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
                </Pressable>
                {booth.logo ? (
                  <Image source={{ uri: booth.logo }} style={[styles.logo, { borderColor: colors.surface, backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                ) : null}
              </View>
              <View style={styles.info}>
                <View style={[styles.boothTag, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name="storefront" size={12} color={colors.brand} />
                  <Text style={[styles.boothTagText, { color: colors.brand }]}>BOOTH</Text>
                </View>
                <Text style={[styles.name, { color: colors.onSurface }]}>{booth.name}</Text>
                <Text style={[styles.owner, { color: colors.muted }]}>by {booth.owner_name} · {booth.listing_count} items</Text>
                {booth.description ? <Text style={[styles.desc, { color: colors.muted }]}>{booth.description}</Text> : null}
                {booth.is_owner ? (
                  <ForgeButton label="Add item to booth" variant="outline" size="sm" onPress={() => router.push(`/bazaar/sell?booth_id=${booth.id}`)} testID="booth-add-item" style={{ alignSelf: "flex-start", marginTop: spacing.md }} icon={<MaterialCommunityIcons name="tag-plus" size={14} color={colors.brand} />} />
                ) : null}
              </View>
              <Eyebrow style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>Items</Eyebrow>
            </View>
          }
          ListEmptyComponent={<View style={{ paddingHorizontal: spacing.lg }}><EmptyState icon="package-variant" title="No items yet" subtitle="This booth hasn't listed anything." /></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { position: "relative" },
  heroImg: { width: "100%", height: 180 },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  backBtn: { position: "absolute", left: spacing.lg, width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logo: { position: "absolute", left: spacing.lg, bottom: -28, width: 72, height: 72, borderRadius: 16, borderWidth: 3 },
  info: { padding: spacing.lg, paddingTop: spacing.xl + spacing.md },
  boothTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  boothTagText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.sm },
  owner: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 4 },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  card: { flex: 1, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cardImg: { width: "100%", height: 120 },
  badge: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.5 },
  cardBody: { padding: spacing.md },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 13, lineHeight: 18, minHeight: 36 },
  cardPrice: { fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 4 },
});
