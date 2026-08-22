import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroListing } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

export default function Marketplace() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [all, setAll] = useState<RetroListing[]>([]);
  const [mine, setMine] = useState<RetroListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([api.retroListings(), api.retroMyListings()]);
      setAll(a); setMine(m);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = tab === "all" ? all : mine;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="mkt-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Businesses for Sale</Text>
          <Eyebrow>Commercial Marketplace</Eyebrow>
        </View>
        <Pressable onPress={() => router.push("/retrospections/marketplace/sell")} style={[styles.addBtn, { backgroundColor: colors.brand }]} testID="mkt-sell">
          <MaterialCommunityIcons name="tag-plus" size={16} color={colors.onBrandPrimary} />
          <Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Sell</Text>
        </Pressable>
      </View>

      <View style={styles.segment}>
        {(["all", "mine"] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.segBtn, { backgroundColor: tab === k ? colors.brand : colors.surfaceSecondary, borderColor: tab === k ? colors.brand : colors.border }]} testID={`mkt-tab-${k}`}>
            <Text style={[styles.segText, { color: tab === k ? colors.onBrandPrimary : colors.onSurface }]}>{k === "all" ? "For Sale" : `My Listings (${mine.length})`}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading label="Loading the marketplace…" />
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="store-search-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>{tab === "all" ? "No businesses listed for sale right now." : "You haven't listed a business yet. Tap Sell to get started."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {list.map((l) => {
            const m = catMeta(l.category);
            return (
              <Pressable key={l.id} onPress={() => router.push(`/retrospections/marketplace/${l.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`mkt-item-${l.id}`}>
                {l.image ? (
                  <Image source={{ uri: l.image }} style={styles.img} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.img, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialCommunityIcons name={m.icon} size={30} color={m.color} />
                  </View>
                )}
                <View style={{ flex: 1, padding: spacing.md }}>
                  <View style={styles.cardTop}>
                    <View style={[styles.catPill, { backgroundColor: `${m.color}22` }]}>
                      <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
                      <Text style={[styles.catText, { color: m.color }]}>{l.category}</Text>
                    </View>
                    {l.is_owner ? <View style={[styles.ownPill, { backgroundColor: colors.brand }]}><Text style={styles.ownText}>Yours</Text></View> : null}
                  </View>
                  <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{l.name}</Text>
                  <Text style={[styles.price, { color: colors.brand }]}>{l.asking_price}</Text>
                  {l.location ? <Text style={[styles.loc, { color: colors.muted }]} numberOfLines={1}><MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.muted} /> {l.location}</Text> : null}
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
  headerTitle: { fontFamily: fonts.display, fontSize: 19 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  addText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  segment: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  segBtn: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  img: { width: 104, height: 116 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  ownPill: { paddingHorizontal: 8, height: 20, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ownText: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#fff" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  price: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: 3 },
  loc: { fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
