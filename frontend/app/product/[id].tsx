import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Listing } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

function formatCountdown(total: number): string {
  if (total <= 0) return "Ended";
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Listing | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [bid, setBid] = useState("");
  const [bidBusy, setBidBusy] = useState(false);
  const [bidError, setBidError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const res = await api.getListing(id);
      setItem(res);
      setSaved(!!res.saved);
      setSecondsLeft(res.seconds_left ?? 0);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Auction countdown
  useEffect(() => {
    if (!item?.is_auction || item.ended || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          load(); // refresh into ended state
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [item?.is_auction, item?.ended, secondsLeft, load]);

  const toggleSave = async () => {
    setSaved((s) => !s);
    try {
      await api.toggleSave("listing", id!);
    } catch {
      setSaved((s) => !s);
    }
  };

  const addToCart = async () => {
    if (!id || added) {
      router.push("/cart");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAdded(true);
    try {
      await api.addToCart(id, 1);
    } catch {
      setAdded(false);
    }
  };

  const buyNow = async () => {
    if (!id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await api.addToCart(id, 1);
      router.push("/cart");
    } catch {
      /* noop */
    }
  };

  const placeBid = async () => {
    if (!item || bidBusy) return;
    setBidError("");
    const cents = Math.round(parseFloat(bid) * 100);
    const min = item.min_next_bid_cents ?? 0;
    if (!cents || cents < min) {
      setBidError(`Enter at least ${formatPrice(min)}.`);
      return;
    }
    setBidBusy(true);
    try {
      const updated = await api.placeBid(item.id, cents);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setItem(updated);
      setSecondsLeft(updated.seconds_left ?? 0);
      setBid("");
    } catch (e: any) {
      setBidError(e?.message ?? "Couldn't place your bid.");
    } finally {
      setBidBusy(false);
    }
  };

  const isAuction = !!item?.is_auction;

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
          <View style={styles.hero}>
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
            <Pressable
              onPress={toggleSave}
              hitSlop={12}
              testID="product-save"
              style={[styles.saveBtn, { top: insets.top + spacing.sm, backgroundColor: colors.surfaceSecondary, borderColor: saved ? colors.brand : colors.border }]}
            >
              <MaterialCommunityIcons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? colors.brand : colors.onSurface} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <ProductBody item={item} isAuction={isAuction} secondsLeft={secondsLeft} colors={colors} />
          </ScrollView>

          {/* Bottom action bar (bid input rises with keyboard) */}
          <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
            <BottomBar
              item={item}
              isAuction={isAuction}
              added={added}
              bid={bid}
              setBid={setBid}
              bidBusy={bidBusy}
              bidError={bidError}
              onAddToCart={addToCart}
              onBuyNow={buyNow}
              onPlaceBid={placeBid}
              insets={insets}
              colors={colors}
            />
          </KeyboardStickyView>
        </>
      )}
    </View>
  );
}

function ProductBody({ item, isAuction, secondsLeft, colors }: any) {
  const router = useRouter();
  return (
    <View style={styles.body}>
        <Eyebrow>{item.category}</Eyebrow>
        <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
        {item.listing_type === "booth" && item.booth_name ? (
          <Pressable
            testID="product-booth-chip"
            onPress={() => item.booth_id && router.push(`/bazaar/booth/${item.booth_id}`)}
            style={[styles.boothChip, { backgroundColor: colors.surfaceTertiary }]}
          >
            <MaterialCommunityIcons name="storefront" size={13} color={colors.brand} />
            <Text style={[styles.boothChipText, { color: colors.brand }]}>{item.booth_name}</Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.brand} />
          </Pressable>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={16} color={colors.brandPrimary} />
            <Text style={[styles.rating, { color: colors.onSurface }]}>{item.rating || "New"}</Text>
            <Text style={[styles.reviews, { color: colors.muted }]}>({item.reviews} reviews)</Text>
          </View>
          <Text style={[styles.price, { color: colors.brandSecondary }]}>{formatPrice(item.price_cents)}</Text>
        </View>

        {isAuction ? (
          <Panel style={{ marginTop: spacing.lg }} testID="auction-panel">
            <View style={styles.auctionHead}>
              <View style={[styles.gavelPill, { backgroundColor: item.ended ? colors.muted : colors.brandSecondary }]}>
                <MaterialCommunityIcons name="gavel" size={13} color={colors.onBrandPrimary} />
                <Text style={[styles.gavelText, { color: colors.onBrandPrimary }]}>{item.ended ? "AUCTION ENDED" : "LIVE AUCTION"}</Text>
              </View>
              {!item.ended ? (
                <View style={styles.clockRow}>
                  <MaterialCommunityIcons name="clock-outline" size={15} color={colors.brand} />
                  <Text testID="auction-countdown" style={[styles.clockText, { color: colors.brand }]}>{formatCountdown(secondsLeft)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.bidStats}>
              <View>
                <Eyebrow>{item.current_bid_cents ? "Current bid" : "Starting bid"}</Eyebrow>
                <Text style={[styles.bidAmount, { color: colors.onSurface }]}>{formatPrice(item.price_cents)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Eyebrow>Bids</Eyebrow>
                <Text style={[styles.bidAmount, { color: colors.onSurface }]}>{item.bid_count ?? 0}</Text>
              </View>
            </View>
            {item.highest_bidder_name ? (
              <Text style={[styles.highBidder, { color: colors.muted }]}>
                {item.ended ? "Won by " : "Highest bidder: "}{item.highest_bidder_name}
              </Text>
            ) : null}
            {item.ended && item.is_winner ? (
              <Text style={[styles.wonNote, { color: colors.brandSecondary }]}>You won this lot — complete your purchase below.</Text>
            ) : null}
          </Panel>
        ) : null}

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
  );
}

function BottomBar({ item, isAuction, added, bid, setBid, bidBusy, bidError, onAddToCart, onBuyNow, onPlaceBid, insets, colors }: any) {
  const barStyle = [styles.bottomBar, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }];

  // Fixed-price: seller sees notice, others add to cart
  if (!isAuction) {
    if (item.is_seller) {
      return (
        <View style={barStyle}>
          <Text style={[styles.ownNote, { color: colors.muted }]}>This is your listing</Text>
        </View>
      );
    }
    return (
      <View style={barStyle}>
        <View>
          <Eyebrow>Total</Eyebrow>
          <Text style={[styles.barPrice, { color: colors.onSurface }]}>{formatPrice(item.price_cents)}</Text>
        </View>
        <ForgeButton
          label={added ? "Added — view cart" : "Add to cart"}
          onPress={onAddToCart}
          testID="add-to-cart"
          icon={<MaterialCommunityIcons name={added ? "cart-arrow-right" : "cart-plus"} size={16} color={colors.onBrandPrimary} />}
        />
      </View>
    );
  }

  // Auction ended
  if (item.ended) {
    if (item.is_winner) {
      return (
        <View style={barStyle}>
          <View>
            <Eyebrow>Winning bid</Eyebrow>
            <Text style={[styles.barPrice, { color: colors.onSurface }]}>{formatPrice(item.price_cents)}</Text>
          </View>
          <ForgeButton label="Buy now" onPress={onBuyNow} testID="buy-now" icon={<MaterialCommunityIcons name="cart-check" size={16} color={colors.onBrandPrimary} />} />
        </View>
      );
    }
    return (
      <View style={barStyle}>
        <Text style={[styles.ownNote, { color: colors.muted }]}>Auction ended</Text>
      </View>
    );
  }

  // Auction live
  if (item.is_seller) {
    return (
      <View style={barStyle}>
        <Text style={[styles.ownNote, { color: colors.muted }]}>Your auction · {item.bid_count ?? 0} bids</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bottomBarCol, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
      {bidError ? <Text testID="bid-error" style={[styles.bidError, { color: colors.error }]}>{bidError}</Text> : null}
      <View style={styles.bidRow}>
        <View style={[styles.bidInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.dollar, { color: colors.muted }]}>$</Text>
          <TextInput
            testID="bid-input"
            value={bid}
            onChangeText={setBid}
            placeholder={`${((item.min_next_bid_cents ?? 0) / 100).toFixed(2)} or more`}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[styles.bidInput, { color: colors.onSurface }]}
          />
        </View>
        <ForgeButton label="Place bid" loading={bidBusy} onPress={onPlaceBid} testID="place-bid" icon={<MaterialCommunityIcons name="gavel" size={16} color={colors.onBrandPrimary} />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { position: "relative" },
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
  saveBtn: {
    position: "absolute",
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 24, marginTop: 6, lineHeight: 30 },
  boothChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: spacing.sm },
  boothChipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rating: { fontFamily: fonts.bodyBold, fontSize: 15 },
  reviews: { fontFamily: fonts.body, fontSize: 13 },
  price: { fontFamily: fonts.display, fontSize: 22 },
  auctionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gavelPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  gavelText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  clockText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  bidStats: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.md },
  bidAmount: { fontFamily: fonts.display, fontSize: 22, marginTop: 2 },
  highBidder: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.sm },
  wonNote: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.sm },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sellerName: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  bottomBarCol: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1 },
  barPrice: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
  ownNote: { fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: "center", flex: 1 },
  bidRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bidInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48 },
  dollar: { fontFamily: fonts.displaySemi, fontSize: 16, marginRight: 4 },
  bidInput: { flex: 1, fontFamily: fonts.body, fontSize: 16 },
  bidError: { fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: spacing.sm },
});
