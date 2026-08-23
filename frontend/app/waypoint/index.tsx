import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";

import { api, WPStay } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

const TYPES = ["All", "Cabin", "Cottage", "Loft", "Airship", "Manor", "Studio", "Houseboat", "Tower"];
const MAP_SIZE = Math.min(Dimensions.get("window").width - spacing.lg * 2, 360);
const HALF = MAP_SIZE / 2;
const PAD = 30;

function StayCard({ item, colors, onPress, onSave, forSale }: { item: WPStay; colors: any; onPress: () => void; onSave: () => void; forSale: boolean }) {
  return (
    <Pressable testID={`wp-stay-${item.id}`} onPress={onPress} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.cover} contentFit="cover" transition={200} /> : (
          <View style={[styles.cover, { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
            <MaterialCommunityIcons name="home-city-outline" size={40} color={colors.muted} />
          </View>
        )}
        <Pressable onPress={onSave} hitSlop={8} style={[styles.heart, { backgroundColor: colors.surface }]} testID={`wp-save-${item.id}`}>
          <MaterialCommunityIcons name={item.saved ? "heart" : "heart-outline"} size={18} color={item.saved ? colors.brand : colors.onSurface} />
        </Pressable>
        {forSale ? (
          <View style={[styles.saleBadge, { backgroundColor: colors.brand }]}><Text style={[styles.saleBadgeText, { color: colors.onBrandPrimary }]}>FOR SALE</Text></View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <View style={[styles.typePill, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[styles.typeText, { color: colors.brand }]}>{item.place_type}</Text>
          </View>
          {item.rating > 0 ? (
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={13} color={colors.brand} />
              <Text style={[styles.ratingText, { color: colors.onSurface }]}>{item.rating.toFixed(1)}</Text>
              <Text style={[styles.reviewText, { color: colors.muted }]}>({item.reviews})</Text>
            </View>
          ) : <Text style={[styles.reviewText, { color: colors.muted }]}>{forSale ? "New listing" : "New"}</Text>}
        </View>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.loc, { color: colors.muted }]}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.muted} /> {item.location} · {item.bedrooms} bed{item.bedrooms !== 1 ? "s" : ""}
        </Text>
        <Text style={[styles.price, { color: colors.brand }]}>{formatPrice(item.price_cents)}{forSale ? null : <Text style={[styles.night, { color: colors.muted }]}> / night</Text>}</Text>
      </View>
    </Pressable>
  );
}

export default function WaypointHome() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ group?: string; kind?: string }>();
  const group = params.group || "";
  const kind = params.kind === "sale" ? "sale" : "rent";
  const forSale = kind === "sale";
  const scoped = !!group || forSale;
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [view, setView] = useState<"list" | "map">("list");
  const [stays, setStays] = useState<WPStay[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setStays(await api.wpStays(q.trim(), type === "All" ? "" : type, group, kind));
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [q, type, group, kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSave = async (id: string) => {
    setStays((prev) => prev.map((s) => s.id === id ? { ...s, saved: !s.saved } : s));
    try { await api.wpSaveStay(id); } catch { load(); }
  };

  const title = forSale ? "Places for Sale" : group || "Waypoint Stays";
  const subtitle = forSale ? "Vacation homes & property for purchase" : group ? "Browse this collection" : "Somewhere to stay, somewhere to settle";

  // Map placement — normalise stay coords around their bounding box.
  const placed = useMemo(() => {
    const withGeo = stays.filter((s) => s.lat != null && s.lng != null);
    if (withGeo.length === 0) return [] as (WPStay & { x: number; y: number })[];
    const lats = withGeo.map((s) => s.lat as number);
    const lngs = withGeo.map((s) => s.lng as number);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = Math.max(0.0001, maxLat - minLat);
    const spanLng = Math.max(0.0001, maxLng - minLng);
    const usable = MAP_SIZE - PAD * 2;
    return withGeo.map((s) => ({
      ...s,
      x: PAD + ((s.lng as number) - minLng) / spanLng * usable,
      y: PAD + (maxLat - (s.lat as number)) / spanLat * usable,
    }));
  }, [stays]);

  const sel = placed.find((p) => p.id === selected) || null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="wp-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{title}</Text>
          <Eyebrow>{subtitle}</Eyebrow>
        </View>
        <Pressable testID="wp-saved" onPress={() => router.push("/waypoint/saved")} hitSlop={10} style={styles.iconGhost}>
          <MaterialCommunityIcons name="heart-outline" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable testID="wp-trips" onPress={() => router.push("/waypoint/bookings")} hitSlop={10} style={styles.iconGhost}>
          <MaterialCommunityIcons name="bag-suitcase-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            returnKeyType="search"
            placeholder="Search stays by name or place…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.onSurface }]}
            testID="wp-search"
          />
          {q ? <Pressable onPress={() => { setQ(""); }} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={[styles.viewToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {(["list", "map"] as const).map((v) => (
            <Pressable key={v} testID={`wp-view-${v}`} onPress={() => setView(v)} style={[styles.toggleBtn, view === v && { backgroundColor: colors.brand }]}>
              <MaterialCommunityIcons name={v === "list" ? "view-list" : "map-outline"} size={18} color={view === v ? colors.onBrandPrimary : colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Type filters — only in the main Search Stays view */}
      {!scoped ? (
        <View>
          <FlatList
            horizontal
            data={TYPES}
            keyExtractor={(t) => t}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
            renderItem={({ item }) => {
              const active = type === item;
              return (
                <Pressable testID={`wp-type-${item}`} onPress={() => setType(item)} style={[styles.typeChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  <Text style={[styles.typeChipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{item}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      ) : <View style={{ height: spacing.md }} />}

      {status === "loading" ? <Loading label="Finding places to stay…" /> :
       status === "error" ? <ErrorState onRetry={load} /> :
       view === "map" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
          {placed.length === 0 ? (
            <EmptyState icon="map-marker-off-outline" title="No stays to map" subtitle="Try a different search or filter." />
          ) : (
            <>
              <View style={[styles.mapWrap, { width: MAP_SIZE, height: MAP_SIZE, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Svg width={MAP_SIZE} height={MAP_SIZE}>
                  {[0.25, 0.5, 0.75].map((f) => (
                    <React.Fragment key={f}>
                      <Line x1={MAP_SIZE * f} y1={PAD / 2} x2={MAP_SIZE * f} y2={MAP_SIZE - PAD / 2} stroke={colors.border} strokeWidth={0.5} strokeDasharray="4 6" />
                      <Line x1={PAD / 2} y1={MAP_SIZE * f} x2={MAP_SIZE - PAD / 2} y2={MAP_SIZE * f} stroke={colors.border} strokeWidth={0.5} strokeDasharray="4 6" />
                    </React.Fragment>
                  ))}
                  <Circle cx={HALF} cy={HALF} r={HALF - PAD} stroke={colors.border} strokeWidth={1} fill="none" strokeDasharray="3 6" />
                </Svg>
                {placed.map((p) => {
                  const active = p.id === selected;
                  return (
                    <Pressable key={p.id} testID={`wp-pin-${p.id}`} onPress={() => setSelected(active ? null : p.id)} hitSlop={6}
                      style={[styles.pin, { left: p.x - 22, top: p.y - 15, backgroundColor: active ? colors.brand : colors.surface, borderColor: colors.brand, transform: [{ scale: active ? 1.1 : 1 }] }]}>
                      <Text style={[styles.pinText, { color: active ? colors.onBrandPrimary : colors.brand }]}>{formatPrice(p.price_cents).replace(".00", "")}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {sel ? (
                <Pressable onPress={() => router.push(`/waypoint/${sel.id}`)} style={[styles.callout, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]} testID="wp-callout">
                  {sel.image_url ? <Image source={{ uri: sel.image_url }} style={styles.calloutImg} contentFit="cover" /> : null}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.calloutTitle, { color: colors.onSurface }]}>{sel.title}</Text>
                    <Text numberOfLines={1} style={[styles.calloutMeta, { color: colors.muted }]}>{sel.place_type} · {sel.location}</Text>
                    <Text style={[styles.calloutPrice, { color: colors.brand }]}>{formatPrice(sel.price_cents)}{forSale ? "" : " / night"}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
                </Pressable>
              ) : <Text style={[styles.tapHint, { color: colors.muted }]}>Tap a price pin to preview a stay.</Text>}
            </>
          )}
        </ScrollView>
       ) : (
        <FlatList
          data={stays}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <StayCard item={item} colors={colors} forSale={forSale} onSave={() => toggleSave(item.id)} onPress={() => router.push(`/waypoint/${item.id}`)} />}
          ListEmptyComponent={<EmptyState icon="home-search-outline" title={forSale ? "Nothing for sale here yet" : "No stays found"} subtitle={forSale ? "Check back soon for new property listings." : "Try a different search or be the first to host here."} />}
        />
       )}

      <Pressable testID="wp-host" onPress={() => router.push("/waypoint/host")} style={[styles.fab, { backgroundColor: colors.brand, bottom: insets.bottom + spacing.lg }]}>
        <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} />
        <Text style={[styles.fabText, { color: colors.onBrandPrimary }]}>Host Your Place</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconGhost: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  viewToggle: { flexDirection: "row", height: 46, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  toggleBtn: { width: 42, alignItems: "center", justifyContent: "center" },
  typeRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  typeChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  typeChipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 170 },
  heart: { position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 5, elevation: 3 },
  saleBadge: { position: "absolute", top: 10, left: 10, height: 24, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  saleBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.5 },
  cardBody: { padding: spacing.md, gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typePill: { height: 22, paddingHorizontal: spacing.sm, borderRadius: radius.pill, justifyContent: "center" },
  typeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  reviewText: { fontFamily: fonts.body, fontSize: 12 },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: 2 },
  loc: { fontFamily: fonts.body, fontSize: 13 },
  price: { fontFamily: fonts.displaySemi, fontSize: 17, marginTop: 4 },
  night: { fontFamily: fonts.body, fontSize: 13 },
  mapWrap: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  pin: { position: "absolute", minWidth: 44, height: 30, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pinText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  callout: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1.5, padding: spacing.sm, paddingRight: spacing.md, marginTop: spacing.md },
  calloutImg: { width: 60, height: 60, borderRadius: radius.sm },
  calloutTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  calloutMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  calloutPrice: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 3 },
  tapHint: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  fab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6, height: 50, paddingHorizontal: spacing.lg, borderRadius: radius.pill, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  fabText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
});
