import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Listing } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, spacing } from "@/src/theme/tokens";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Listing | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const res = await api.getListing(id);
      setItem(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addToCart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAdded(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {status === "loading" ? (
        <>
          <View style={{ height: insets.top }} />
          <Loading label="Fetching the ware…" />
        </>
      ) : status === "error" || !item ? (
        <>
          <View style={{ height: insets.top }} />
          <ErrorState onRetry={load} />
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
            <View>
              <Image
                source={{ uri: item.image }}
                style={[styles.image, { backgroundColor: colors.surfaceTertiary }]}
                contentFit="cover"
                transition={250}
              />
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                testID="product-back"
                style={[styles.backBtn, { top: insets.top + spacing.sm, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.body}>
              <Eyebrow>{item.category}</Eyebrow>
              <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.ratingRow}>
                  <MaterialCommunityIcons name="star" size={16} color={colors.brandPrimary} />
                  <Text style={[styles.rating, { color: colors.onSurface }]}>{item.rating}</Text>
                  <Text style={[styles.reviews, { color: colors.muted }]}>({item.reviews} reviews)</Text>
                </View>
                <Text style={[styles.price, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
              </View>

              <Hairline style={{ marginVertical: spacing.lg }} />

              <Panel style={styles.sellerRow}>
                <AvatarInitials name={item.seller} size={44} />
                <View style={{ flex: 1 }}>
                  <Eyebrow>Sold by</Eyebrow>
                  <Text style={[styles.sellerName, { color: colors.onSurface }]}>{item.seller}</Text>
                </View>
                <MaterialCommunityIcons name="check-decagram" size={22} color={colors.aether} />
              </Panel>

              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Description</Text>
              <Text style={[styles.description, { color: colors.muted }]}>{item.description}</Text>
            </View>
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <View>
              <Eyebrow>Total</Eyebrow>
              <Text style={[styles.barPrice, { color: colors.onSurface }]}>{formatPrice(item.price_cents)}</Text>
            </View>
            <ForgeButton
              label={added ? "Added to cart" : "Add to cart"}
              onPress={addToCart}
              testID="add-to-cart"
              icon={<MaterialCommunityIcons name={added ? "check" : "cart-plus"} size={16} color={colors.onBrandPrimary} />}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  image: { width: "100%", height: 320 },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 24, marginTop: 6, lineHeight: 30 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rating: { fontFamily: fonts.bodyBold, fontSize: 15 },
  reviews: { fontFamily: fonts.body, fontSize: 13 },
  price: { fontFamily: fonts.display, fontSize: 22 },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sellerName: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  barPrice: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
});
