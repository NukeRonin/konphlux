import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, WPBooking } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

export default function MyTrips() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<WPBooking[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setBookings(await api.wpBookings());
      setStatus("ready");
    } catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="trips-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>My Trips</Text>
          <Eyebrow>Your Waypoint bookings</Eyebrow>
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`trip-${item.id}`} onPress={() => router.push(`/waypoint/${item.stay_id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" /> : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}><MaterialCommunityIcons name="home-city-outline" size={28} color={colors.muted} /></View>
            )}
            <View style={{ flex: 1 }}>
              <View style={[styles.statusPill, { backgroundColor: colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name="check-decagram" size={12} color={colors.brand} />
                <Text style={[styles.statusText, { color: colors.brand }]}>Confirmed</Text>
              </View>
              <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.stay_title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.location}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{dayjs(item.check_in).format("MMM D")} – {dayjs(item.check_out).format("MMM D")} · {item.guests} guest{item.guests !== 1 ? "s" : ""}</Text>
              <Text style={[styles.price, { color: colors.brand }]}>{formatPrice(item.total_cents)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching your trips…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="bag-suitcase-outline" title="No trips yet" subtitle="Book a stay and it'll show up here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  card: { flexDirection: "row", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  thumb: { width: 92, height: 92, borderRadius: radius.sm },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", height: 20, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  title: { fontFamily: fonts.displaySemi, fontSize: 16.5, marginTop: 4 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  price: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 4 },
});
