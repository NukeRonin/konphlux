import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api, BazaarResponse, Booth, Listing } from "@/src/api/client";
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
  const auction = !!item.is_auction;
  return (
    <Pressable
      testID={`listing-${item.id}`}
      onPress={() => router.push(`/product/${item.id}`)}
      style={({ pressed }) => [styles.card, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={[styles.cardInner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View>
          <Image
            source={{ uri: item.image }}
            style={[styles.image, { backgroundColor: colors.surfaceTertiary }]}
            contentFit="cover"
            transition={250}
          />
          {auction ? (
            <View style={[styles.auctionBadge, { backgroundColor: item.ended ? colors.muted : colors.brandSecondary }]}>
              <MaterialCommunityIcons name="gavel" size={11} color={colors.onBrandPrimary} />
              <Text style={[styles.auctionBadgeText, { color: colors.onBrandPrimary }]}>
                {item.ended ? "ENDED" : "AUCTION"}
              </Text>
            </View>
          ) : null}
        </View>
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
          {auction ? (
            <Text style={[styles.auctionLabel, { color: colors.muted }]}>
              {item.current_bid_cents ? "Current bid" : "Starting"}
            </Text>
          ) : null}
          <Text style={[styles.price, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BazaarScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const [data, setData] = useState<BazaarResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [active, setActive] = useState(ALL);
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);

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

  // Deep-link category (e.g. from district shortcuts: eBooks / Audio Books).
  useEffect(() => {
    if (params.category) setActive(params.category);
  }, [params.category]);

  // Deep-link search (e.g. from Bluepaint Materials Estimator "Purchase in Bazaar").
  useEffect(() => {
    if (params.q !== undefined) setSearch(params.q);
  }, [params.q]);

  useFocusEffect(
    useCallback(() => {
      load();
      api.getCart().then((c) => setCartCount(c.count)).catch(() => {});
      api.unreadCount().then((r) => setUnread(r.count)).catch(() => {});
      api.listBooths().then(setBooths).catch(() => {});
    }, [load]),
  );

  const saveCurrentSearch = async () => {
    if (savingSearch) return;
    setSavingSearch(true);
    try {
      await api.saveSearch(search.trim(), active);
      const label = search.trim() || active;
      Alert.alert("Search saved", `We'll alert you in your notifications when new items match "${label}".`);
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Please try again.");
    } finally {
      setSavingSearch(false);
    }
  };

  const canSaveSearch = search.trim().length > 0 || active !== ALL;

  const chips = useMemo(() => [ALL, ...(data?.categories ?? [])], [data]);
  const listings = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.listings ?? []).filter((l) => {
      if (active !== ALL && l.category !== active) return false;
      if (words.length === 0) return true;
      const hay = `${l.title} ${l.category} ${l.seller ?? ""}`.toLowerCase();
      return words.some((w) => hay.includes(w));
    });
  }, [data, active, search]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <AppHeader
        title="Bazaar"
        subtitle="Buy, sell, bid, barter"
        actions={[
          { icon: "bell-outline", onPress: () => router.push("/notifications"), testID: "notif-btn", badge: unread > 0 },
          { icon: "tag-plus", onPress: () => router.push("/bazaar/sell"), testID: "sell-btn" },
          { icon: "cart-outline", onPress: () => router.push("/cart"), testID: "cart-btn", badge: cartCount > 0 },
        ]}
      />
      {status === "loading" ? (
        <Loading label="Opening the stalls…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <View style={[styles.chipBar, { borderBottomColor: colors.border }]}>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
              <TextInput
                testID="bazaar-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search the Bazaar…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={[styles.searchInput, { color: colors.onSurface }]}
              />
              {search ? (
                <Pressable testID="bazaar-search-clear" onPress={() => setSearch("")} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {chips.map((c) => (
                <Chip key={c} label={c} active={active === c} onPress={() => setActive(c)} />
              ))}
            </ScrollView>
            {canSaveSearch ? (
              <Pressable
                testID="bazaar-save-search"
                onPress={saveCurrentSearch}
                disabled={savingSearch}
                style={[styles.saveSearch, { borderColor: colors.brand, backgroundColor: `${colors.brand}14` }]}
              >
                <MaterialCommunityIcons name="bell-plus-outline" size={15} color={colors.brand} />
                <Text style={[styles.saveSearchText, { color: colors.brand }]} numberOfLines={1}>
                  {savingSearch ? "Saving…" : `Save this search — alert me${search.trim() ? ` for "${search.trim()}"` : active !== ALL ? ` in ${active}` : ""}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <FlatList
            data={listings}
            keyExtractor={(l) => l.id}
            numColumns={2}
            columnWrapperStyle={listings.length ? styles.column : undefined}
            contentContainerStyle={listings.length ? styles.list : styles.listEmpty}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ProductCard item={item} />}
            ListHeaderComponent={
              active === ALL && !search.trim() && booths.length ? (
                <View style={styles.featuredWrap}>
                  <View style={styles.featuredHead}>
                    <Eyebrow>Featured storefronts</Eyebrow>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
                    {booths.map((b) => (
                      <Pressable
                        key={b.id}
                        testID={`featured-booth-${b.id}`}
                        onPress={() => router.push(`/bazaar/booth/${b.id}`)}
                        style={[styles.boothCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                      >
                        <Image source={{ uri: b.banner || b.image }} style={[styles.boothBanner, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                        {b.logo ? (
                          <Image source={{ uri: b.logo }} style={[styles.boothLogo, { borderColor: colors.surfaceSecondary, backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                        ) : (
                          <View style={[styles.boothLogo, styles.boothLogoFallback, { borderColor: colors.surfaceSecondary, backgroundColor: colors.surfaceTertiary }]}>
                            <MaterialCommunityIcons name="storefront" size={16} color={colors.brand} />
                          </View>
                        )}
                        <View style={styles.boothInfo}>
                          <Text numberOfLines={1} style={[styles.boothName, { color: colors.onSurface }]}>{b.name}</Text>
                          <Text style={[styles.boothMeta, { color: colors.muted }]}>{b.listing_count} items</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={search ? "magnify-close" : "storefront-outline"} size={40} color={colors.brand} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  {search ? "No matching wares" : "Nothing here yet"}
                </Text>
                <Text style={[styles.emptyBody, { color: colors.muted }]}>
                  {search
                    ? `We couldn't find anything for "${search.trim()}"${active !== ALL ? ` in ${active}` : ""}. Try a different search.`
                    : `There are no items in ${active} right now. Check back soon or explore another category.`}
                </Text>
                <Pressable
                  testID="bazaar-empty-reset"
                  onPress={() => { setSearch(""); setActive(ALL); }}
                  style={[styles.emptyBtn, { backgroundColor: colors.brand }]}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={colors.onBrandPrimary} />
                  <Text style={[styles.emptyBtnText, { color: colors.onBrandPrimary }]}>
                    {search ? "Clear search" : "Browse all items"}
                  </Text>
                </Pressable>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipBar: { borderBottomWidth: 1, justifyContent: "center", paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, height: 42, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
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
  saveSearch: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.xs, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  saveSearchText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  featuredWrap: { marginBottom: spacing.md },
  featuredHead: { marginBottom: spacing.sm },
  featuredRow: { gap: spacing.md, paddingRight: spacing.sm },
  boothCard: { width: 190, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  boothBanner: { width: "100%", height: 82 },
  boothLogo: { position: "absolute", top: 60, left: 12, width: 44, height: 44, borderRadius: 11, borderWidth: 2 },
  boothLogoFallback: { alignItems: "center", justifyContent: "center" },
  boothInfo: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  boothName: { fontFamily: fonts.displaySemi, fontSize: 14 },
  boothMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  listEmpty: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.md },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, textAlign: "center" },
  emptyBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, marginTop: spacing.sm },
  emptyBtnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
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
  auctionBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  auctionBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.5 },
  cardBody: { padding: spacing.md, gap: 4 },
  title: { fontFamily: fonts.displaySemi, fontSize: 14, lineHeight: 19, minHeight: 38 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { fontFamily: fonts.body, fontSize: 12 },
  auctionLabel: { fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  price: { fontFamily: fonts.bodyBold, fontSize: 16, marginTop: 2 },
});
