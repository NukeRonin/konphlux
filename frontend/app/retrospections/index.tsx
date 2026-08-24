import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroBusiness } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta, fmtDistance } from "@/src/utils/retro";
import { Stars } from "@/src/components/RetroStars";

export default function RetrospectionsHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [list, setList] = useState<RetroBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (category: string, query: string) => {
    setLoading(true);
    try {
      const [meta, biz] = await Promise.all([
        cats.length ? Promise.resolve({ categories: cats }) : api.retroMeta(),
        api.retroBusinesses({ category: category === "All" ? "" : category, q: query }),
      ]);
      if (!cats.length) setCats((meta as any).categories);
      setList(biz);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [cats]);

  useFocusEffect(useCallback(() => { load(cat, q); }, [cat])); // reload on focus + category change

  const onSearch = () => load(cat, q);

  const toggleFav = async (b: RetroBusiness) => {
    const next = !b.is_favorite;
    setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_favorite: next } : x)));
    try { next ? await api.retroAddFavorite(b.id) : await api.retroRemoveFavorite(b.id); }
    catch { setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, is_favorite: !next } : x))); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="retro-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Retrospections</Text>
          <Eyebrow>Reviews near you</Eyebrow>
        </View>
        <Pressable onPress={() => router.push("/retrospections/submit")} style={[styles.addBtn, { backgroundColor: colors.brand }]} testID="retro-submit">
          <MaterialCommunityIcons name="star-plus" size={16} color={colors.onBrandPrimary} />
          <Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Review</Text>
        </Pressable>
      </View>

      <View style={styles.quick}>
        {[
          { label: "Nearby", icon: "map-search-outline" as const, route: "/retrospections/map" },
          { label: "Status", icon: "clipboard-pulse-outline" as const, route: "/retrospections/status" },
          { label: "Temporary Closures", icon: "store-clock-outline" as const, route: "/retrospections/status?tab=closures" },
          { label: "Closing Soon", icon: "store-off-outline" as const, route: "/retrospections/status?tab=closing" },
          { label: "Favorites", icon: "heart-outline" as const, route: "/retrospections/favorites" },
          { label: "For Sale", icon: "storefront-outline" as const, route: "/retrospections/marketplace" },
        ].map((ql) => (
          <Pressable key={ql.label} onPress={() => router.push(ql.route as any)} style={[styles.quickTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`retro-quick-${ql.label}`}>
            <MaterialCommunityIcons name={ql.icon} size={18} color={colors.brand} />
            <Text style={[styles.quickText, { color: colors.onSurface }]}>{ql.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Search businesses" placeholderTextColor={colors.muted}
          style={[styles.searchInput, { color: colors.onSurface }]} returnKeyType="search" onSubmitEditing={onSearch} testID="retro-search"
        />
        {q ? <Pressable onPress={() => { setQ(""); load(cat, ""); }} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {["All", ...cats].map((c) => {
          const active = cat === c;
          const m = c === "All" ? { icon: "shape" as const, color: colors.brand } : catMeta(c);
          return (
            <Pressable key={c} onPress={() => setCat(c)} testID={`retro-cat-${c}`}
              style={[styles.chip, { backgroundColor: active ? m.color : colors.surfaceSecondary, borderColor: active ? m.color : colors.border }]}>
              <MaterialCommunityIcons name={m.icon as any} size={13} color={active ? "#fff" : m.color} />
              <Text style={[styles.chipText, { color: active ? "#fff" : colors.onSurface }]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Loading label="Gathering reviews…" />
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="storefront-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>No businesses here yet. Tap Review to add one.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {list.map((b) => {
            const m = catMeta(b.category);
            return (
              <Pressable key={b.id} onPress={() => router.push(`/retrospections/business/${b.id}`)}
                style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`retro-biz-${b.id}`}>
                {b.image ? (
                  <Image source={{ uri: b.image }} style={styles.cardImg} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.cardImg, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialCommunityIcons name={m.icon} size={26} color={m.color} />
                  </View>
                )}
                <Pressable onPress={() => toggleFav(b)} hitSlop={8} style={styles.heartOverlay} testID={`retro-fav-${b.id}`}>
                  <MaterialCommunityIcons name={b.is_favorite ? "heart" : "heart-outline"} size={18} color={b.is_favorite ? "#FC8181" : "#fff"} />
                </Pressable>
                <View style={{ flex: 1, padding: spacing.md }}>
                  <View style={styles.cardTop}>
                    <View style={[styles.catPill, { backgroundColor: `${m.color}22` }]}>
                      <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
                      <Text style={[styles.catText, { color: m.color }]}>{b.category}</Text>
                    </View>
                    {b.distance_km != null ? <Text style={[styles.dist, { color: colors.muted }]}>{fmtDistance(b.distance_km)}</Text> : null}
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>{b.name}</Text>
                  <View style={styles.ratingRow}>
                    <Stars rating={b.avg_rating} />
                    <Text style={[styles.ratingText, { color: colors.onSurface }]}>{b.avg_rating.toFixed(1)}</Text>
                    <Text style={[styles.ratingCount, { color: colors.muted }]}>({b.review_count})</Text>
                  </View>
                  {b.address ? <Text style={[styles.addr, { color: colors.muted }]} numberOfLines={1}>{b.address}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  quick: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  quickTile: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, borderWidth: 1 },
  quickText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  heartOverlay: { position: "absolute", top: 6, left: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  addText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.md, height: 46, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  cardImg: { width: 96, height: 108 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  dist: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  ratingCount: { fontFamily: fonts.body, fontSize: 12 },
  addr: { fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
