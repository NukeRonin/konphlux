import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, WPStay } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

export default function SavedStays() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stays, setStays] = useState<WPStay[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try { setStatus("loading"); setStays(await api.wpSaved()); setStatus("ready"); }
    catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unsave = async (id: string) => {
    setStays((prev) => prev.filter((s) => s.id !== id));
    try { await api.wpSaveStay(id); } catch { load(); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="saved-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Saved Stays</Text>
          <Eyebrow>Your Waypoint wish list</Eyebrow>
        </View>
      </View>

      <FlatList
        data={stays}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`saved-${item.id}`} onPress={() => router.push(`/waypoint/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" /> : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}><MaterialCommunityIcons name="home-city-outline" size={26} color={colors.muted} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.typeText, { color: colors.brand }]}>{item.place_type.toUpperCase()}{item.listing_kind === "sale" ? " · FOR SALE" : ""}</Text>
              <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{item.location}</Text>
              <Text style={[styles.price, { color: colors.brand }]}>{formatPrice(item.price_cents)}{item.listing_kind === "sale" ? "" : " / night"}</Text>
            </View>
            <Pressable onPress={() => unsave(item.id)} hitSlop={10} testID={`saved-remove-${item.id}`}>
              <MaterialCommunityIcons name="heart" size={22} color={colors.brand} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching your saved stays…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="heart-outline" title="No saved stays yet" subtitle="Tap the heart on any stay to add it to your wish list." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm },
  thumb: { width: 84, height: 84, borderRadius: radius.sm },
  typeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  title: { fontFamily: fonts.displaySemi, fontSize: 16.5, marginTop: 3 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  price: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 4 },
});
