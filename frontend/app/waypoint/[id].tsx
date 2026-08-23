import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, WPStayDetail } from "@/src/api/client";
import { ForgeButton } from "@/src/components/ForgeButton";
import { DiscussItemButton } from "@/src/components/DiscussItemButton";
import { ErrorState, Loading } from "@/src/components/States";
import { WPReviews } from "@/src/components/WPReviews";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

function Stepper({ label, value, onDec, onInc, colors, canDec, canInc, display }: any) {
  return (
    <View style={styles.stepRow}>
      <Text style={[styles.stepLabel, { color: colors.onSurface }]}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable onPress={onDec} disabled={!canDec} style={[styles.stepBtn, { borderColor: colors.border, opacity: canDec ? 1 : 0.4 }]} testID={`wp-dec-${label}`}>
          <MaterialCommunityIcons name="minus" size={18} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.stepValue, { color: colors.onSurface }]}>{display ?? value}</Text>
        <Pressable onPress={onInc} disabled={!canInc} style={[styles.stepBtn, { borderColor: colors.border, opacity: canInc ? 1 : 0.4 }]} testID={`wp-inc-${label}`}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

export default function StayDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stay, setStay] = useState<WPStayDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [checkIn, setCheckIn] = useState(dayjs().add(2, "day").startOf("day"));
  const [nights, setNights] = useState(2);
  const [guests, setGuests] = useState(1);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState<null | { total: number; checkOut: string }>(null);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const s = await api.wpStay(id!);
      setStay(s);
      setGuests((g) => Math.min(g, s.max_guests));
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSave = async () => {
    if (!stay) return;
    setStay({ ...stay, saved: !stay.saved });
    try { await api.wpSaveStay(stay.id); } catch { load(); }
  };

  const enquire = () => {
    if (!stay) return;
    Alert.alert("Enquire to buy", `Contact ${stay.host_name} about "${stay.title}". They'll be in touch to arrange a viewing.`, [{ text: "OK" }]);
  };

  const book = async () => {
    if (!stay || booking) return;
    setBooking(true);
    try {
      const res = await api.wpBookStay(stay.id, { check_in: checkIn.format("YYYY-MM-DD"), nights, guests });
      setDone({ total: res.booking.total_cents, checkOut: res.booking.check_out });
    } catch (e: any) {
      Alert.alert("Couldn't book", e?.message || "Please try again.");
    } finally { setBooking(false); }
  };

  const removeListing = () => {
    if (!stay) return;
    Alert.alert("Remove listing?", `"${stay.title}" will no longer be bookable.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { try { await api.wpDeleteStay(stay.id); router.back(); } catch { /* ignore */ } } },
    ]);
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Opening the stay…" /></View>;
  if (status === "error" || !stay) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><ErrorState onRetry={load} /></View>;

  const total = stay.price_cents * nights;
  const forSale = stay.listing_kind === "sale";

  if (done) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top, alignItems: "center", justifyContent: "center", padding: spacing.xl }]}>
        <View style={[styles.doneIcon, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="check" size={40} color={colors.onBrandPrimary} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.onSurface }]}>Booking Confirmed</Text>
        <Text style={[styles.doneBody, { color: colors.muted }]}>
          You're booked at {stay.title} for {nights} night{nights !== 1 ? "s" : ""} from {checkIn.format("MMM D")} to {dayjs(done.checkOut).format("MMM D")}.
        </Text>
        <Text style={[styles.doneBody, { color: colors.muted, marginTop: spacing.xs }]}>
          {formatPrice(done.total)} was recorded in your Treasury as a Waypoint deal.
        </Text>
        <View style={{ height: spacing.xl }} />
        <ForgeButton label="View my trips" fullWidth size="lg" testID="wp-view-trips" onPress={() => router.replace("/waypoint/bookings")} />
        <Pressable onPress={() => router.replace("/waypoint")} style={{ marginTop: spacing.md }}>
          <Text style={[styles.linkText, { color: colors.brand }]}>Back to stays</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View>
          {stay.image_url ? <Image source={{ uri: stay.image_url }} style={styles.hero} contentFit="cover" transition={200} /> : (
            <View style={[styles.hero, { backgroundColor: colors.surfaceTertiary }]} />
          )}
          <Pressable onPress={() => router.back()} style={[styles.backFab, { top: insets.top + spacing.sm, backgroundColor: colors.surface }]} hitSlop={10} testID="wp-detail-back">
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Pressable onPress={toggleSave} style={[styles.saveFab, { top: insets.top + spacing.sm, backgroundColor: colors.surface }]} hitSlop={10} testID="wp-detail-save">
            <MaterialCommunityIcons name={stay.saved ? "heart" : "heart-outline"} size={22} color={stay.saved ? colors.brand : colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.rowBetween}>
            <View style={[styles.typePill, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.typeText, { color: colors.brand }]}>{stay.place_type}</Text>
            </View>
            {stay.rating > 0 ? (
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={15} color={colors.brand} />
                <Text style={[styles.ratingText, { color: colors.onSurface }]}>{stay.rating.toFixed(1)}</Text>
                <Text style={[styles.reviewText, { color: colors.muted }]}>· {stay.reviews} reviews</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]}>{stay.title}</Text>
          <Text style={[styles.loc, { color: colors.muted }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.muted} /> {stay.location}
          </Text>
          <View style={{ marginTop: spacing.md, alignSelf: "flex-start" }}>
            <DiscussItemButton category="Waypoint" title={stay.title} context={`Anyone stayed at "${stay.title}" in ${stay.location}? Share your thoughts.`} />
          </View>

          <View style={styles.factsRow}>
            <View style={styles.fact}><MaterialCommunityIcons name="account-group-outline" size={18} color={colors.brand} /><Text style={[styles.factText, { color: colors.onSurface }]}>Sleeps {stay.max_guests}</Text></View>
            <View style={styles.fact}><MaterialCommunityIcons name="bed-outline" size={18} color={colors.brand} /><Text style={[styles.factText, { color: colors.onSurface }]}>{stay.bedrooms} bed{stay.bedrooms !== 1 ? "s" : ""}</Text></View>
            <View style={styles.fact}><MaterialCommunityIcons name="account-outline" size={18} color={colors.brand} /><Text style={[styles.factText, { color: colors.onSurface }]}>{stay.host_name}</Text></View>
          </View>

          {stay.description ? <Text style={[styles.desc, { color: colors.onSurface }]}>{stay.description}</Text> : null}

          {stay.amenities.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>What this place offers</Text>
              <View style={styles.amenities}>
                {stay.amenities.map((a) => (
                  <View key={a} style={[styles.amenity, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.brand} />
                    <Text style={[styles.amenityText, { color: colors.onSurface }]}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {forSale ? (
            <View style={[styles.saleBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
              <View>
                <Text style={[styles.saleLabel, { color: colors.muted }]}>Asking price</Text>
                <Text style={[styles.salePrice, { color: colors.brand }]}>{formatPrice(stay.price_cents)}</Text>
              </View>
              <MaterialCommunityIcons name="home-city" size={30} color={colors.brand} />
            </View>
          ) : !stay.is_host ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Your trip</Text>
              <View style={[styles.bookingBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Stepper label="Check-in" colors={colors}
                  display={checkIn.format("ddd, MMM D")}
                  canDec={checkIn.isAfter(dayjs().startOf("day"))} canInc
                  onDec={() => setCheckIn((d) => d.subtract(1, "day").isBefore(dayjs().startOf("day")) ? d : d.subtract(1, "day"))}
                  onInc={() => setCheckIn((d) => d.add(1, "day"))} />
                <Stepper label="Nights" value={nights} colors={colors}
                  canDec={nights > 1} canInc={nights < 60}
                  onDec={() => setNights((n) => Math.max(1, n - 1))} onInc={() => setNights((n) => Math.min(60, n + 1))} />
                <Stepper label="Guests" value={guests} colors={colors}
                  canDec={guests > 1} canInc={guests < stay.max_guests}
                  onDec={() => setGuests((g) => Math.max(1, g - 1))} onInc={() => setGuests((g) => Math.min(stay.max_guests, g + 1))} />
                <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.muted }]}>{formatPrice(stay.price_cents)} × {nights} night{nights !== 1 ? "s" : ""}</Text>
                  <Text style={[styles.totalValue, { color: colors.onSurface }]}>{formatPrice(total)}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={[styles.hostNote, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="home-account" size={20} color={colors.brand} />
              <Text style={[styles.hostNoteText, { color: colors.onSurface }]}>This is your listing.</Text>
            </View>
          )}

          {!forSale ? <WPReviews stayId={stay.id} canReview={stay.can_review} onPosted={load} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {forSale ? (
          <View style={{ flex: 1 }}>
            <ForgeButton label="Enquire to buy" fullWidth size="lg" testID="wp-enquire" onPress={enquire} icon={<MaterialCommunityIcons name="email-outline" size={18} color={colors.onBrandPrimary} />} />
          </View>
        ) : !stay.is_host ? (
          <>
            <View>
              <Text style={[styles.footerPrice, { color: colors.onSurface }]}>{formatPrice(total)}</Text>
              <Text style={[styles.footerSub, { color: colors.muted }]}>total · {nights} night{nights !== 1 ? "s" : ""}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <ForgeButton label={booking ? "Booking…" : "Book a Stay"} fullWidth size="lg" disabled={booking} testID="wp-book" onPress={book} />
            </View>
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <ForgeButton label="Remove listing" variant="ghost" fullWidth size="lg" testID="wp-remove" onPress={removeListing} icon={<MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.brand} />} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { width: "100%", height: 260 },
  backFab: { position: "absolute", left: spacing.lg, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  saveFab: { position: "absolute", right: spacing.lg, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  saleBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.md, borderWidth: 1.5, padding: spacing.lg, marginTop: spacing.lg },
  saleLabel: { fontFamily: fonts.body, fontSize: 13 },
  salePrice: { fontFamily: fonts.display, fontSize: 26, marginTop: 2 },
  content: { padding: spacing.lg },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typePill: { height: 24, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center" },
  typeText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  reviewText: { fontFamily: fonts.body, fontSize: 12.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: spacing.md },
  loc: { fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  factsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.md },
  fact: { flexDirection: "row", alignItems: "center", gap: 6 },
  factText: { fontFamily: fonts.bodyMedium, fontSize: 13.5 },
  desc: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  amenity: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  amenityText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  bookingBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  stepLabel: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  stepControls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: fonts.bodyBold, fontSize: 14.5, minWidth: 96, textAlign: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.md },
  totalLabel: { fontFamily: fonts.body, fontSize: 14 },
  totalValue: { fontFamily: fonts.displaySemi, fontSize: 18 },
  hostNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  hostNoteText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  footerPrice: { fontFamily: fonts.displaySemi, fontSize: 18 },
  footerSub: { fontFamily: fonts.body, fontSize: 12 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.display, fontSize: 26, marginTop: spacing.lg },
  doneBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: spacing.sm },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
});
