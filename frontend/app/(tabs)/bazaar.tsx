import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, BazaarResponse, Listing } from "@/src/api/client";
import { AppHeader } from "@/src/components/AppHeader";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

const ALL = "All";

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`chip-${label}`}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.brand : colors.surfaceSecondary,
          borderColor: active ? colors.brand : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.onBrandPrimary : colors.onSurface },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProductCard({ item }: { item: Listing }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`listing-${item.id}`}
      onPress={() => router.push(`/product/${item.id}`)}
      style={({ pressed }) => [styles.card, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.cardInner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Image
          source={{ uri: item.image }}
          style={[styles.image, { backgroundColor: colors.surfaceTertiary }]}
          contentFit="cover"
          transition={250}
        />
        <View style={styles.cardBody}>
          <Eyebrow>{item.category}</Eyebrow>
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>
            {item.title}
          </Text>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={13} color={colors.brandPrimary} />
            <Text style={[styles.rating, { color: colors.muted }]}>
              {item.rating} · {item.reviews}
            </Text>
          </View>
          <Text style={[styles.price, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BazaarScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState<BazaarResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [active, setActive] = useState(ALL);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.getBazaar();
      setData(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chips = useMemo(() => [ALL, ...(data?.categories ?? [])], [data]);
  const listings = useMemo(
    () => (data?.listings ?? []).filter((l) => active === ALL || l.category === active),
    [data, active],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <AppHeader
        title="Bazaar"
        subtitle="Buy, sell, bid, barter"
        actions={[{ icon: "cart-outline", onPress: () => {}, testID: "cart-btn", badge: true }]}
      />
      {status === "loading" ? (
        <Loading label="Opening the stalls…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <View style={[styles.chipBar, { borderBottomColor: colors.border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {chips.map((c) => (
                <Chip key={c} label={c} active={active === c} onPress={() => setActive(c)} />
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={listings}
            keyExtractor={(l) => l.id}
            numColumns={2}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ProductCard item={item} />}
          />
        </>
      )}
    </View>
  );
}

const CHIP_ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipBar: { height: CHIP_ROW_HEIGHT, borderBottomWidth: 1, justifyContent: "center" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  column: { gap: spacing.md },
  card: { flex: 1, marginBottom: spacing.md },
  cardInner: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  image: { width: "100%", height: 130 },
  cardBody: { padding: spacing.md, gap: 4 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 19, minHeight: 38 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { fontFamily: fonts.body, fontSize: 12 },
  price: { fontFamily: fonts.bodyBold, fontSize: 16, marginTop: 2 },
});
