import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroListing } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

export default function ListingDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<RetroListing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try { setL(await api.retroListing(id)); } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const contact = () => {
    if (!l) return;
    const c = l.contact.trim();
    if (c.includes("@")) Linking.openURL(`mailto:${c}?subject=Enquiry about ${encodeURIComponent(l.name)}`);
    else if (/\d/.test(c)) Linking.openURL(`tel:${c.replace(/[^\d+]/g, "")}`);
    else Alert.alert("Contact the seller", c);
  };

  const remove = () => {
    if (!l) return;
    Alert.alert("Remove listing", `Take "${l.name}" off the marketplace?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await api.retroDeleteListing(l.id); router.back(); } },
    ]);
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Loading…" /></View>;
  if (!l) return <View style={[styles.screen, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: colors.muted, fontFamily: fonts.body }}>Listing not found.</Text></View>;

  const m = catMeta(l.category);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {l.image ? (
            <Image source={{ uri: l.image }} style={styles.heroImg} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.heroImg, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
              <MaterialCommunityIcons name={m.icon} size={52} color={m.color} />
            </View>
          )}
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, { top: insets.top + spacing.sm }]} testID="listing-back">
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={{ padding: spacing.lg }}>
          <View style={[styles.catPill, { backgroundColor: `${m.color}22`, alignSelf: "flex-start" }]}>
            <MaterialCommunityIcons name={m.icon} size={12} color={m.color} />
            <Text style={[styles.catText, { color: m.color }]}>{l.category}</Text>
          </View>
          <Text style={[styles.name, { color: colors.onSurface }]}>{l.name}</Text>
          <Text style={[styles.price, { color: colors.brand }]}>{l.asking_price}</Text>

          <View style={styles.metaGrid}>
            {l.location ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.onSurface }]}>{l.location}</Text>
              </View>
            ) : null}
            {l.revenue ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.onSurface }]}>{l.revenue}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account-outline" size={16} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.onSurface }]}>{l.seller_name}</Text>
            </View>
          </View>

          {l.description ? <Text style={[styles.body, { color: colors.onSurface }]}>{l.description}</Text> : null}
          {l.reason ? (
            <View style={[styles.reasonBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.reasonLabel, { color: colors.muted }]}>REASON FOR SELLING</Text>
              <Text style={[styles.reasonText, { color: colors.onSurface }]}>{l.reason}</Text>
            </View>
          ) : null}

          {l.is_owner ? (
            <Pressable onPress={remove} style={[styles.contactBtn, { backgroundColor: colors.surfaceSecondary, borderColor: "#E53E3E", borderWidth: 1 }]} testID="listing-delete">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#E53E3E" />
              <Text style={[styles.contactText, { color: "#E53E3E" }]}>Remove my listing</Text>
            </Pressable>
          ) : (
            <Pressable onPress={contact} style={[styles.contactBtn, { backgroundColor: colors.brand }]} testID="listing-contact">
              <MaterialCommunityIcons name="email-fast-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={[styles.contactText, { color: colors.onBrandPrimary }]}>Contact seller</Text>
            </Pressable>
          )}
          <Text style={[styles.contactHint, { color: colors.muted }]}>{l.contact}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { position: "relative" },
  heroImg: { width: "100%", height: 220 },
  backBtn: { position: "absolute", left: spacing.lg, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, height: 24, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  name: { fontFamily: fonts.display, fontSize: 25, marginTop: spacing.sm },
  price: { fontFamily: fonts.displaySemi, fontSize: 22, marginTop: 4 },
  metaGrid: { marginTop: spacing.md, gap: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.lg },
  reasonBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  reasonLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5 },
  reasonText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  contactBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.md, marginTop: spacing.xl },
  contactText: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  contactHint: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
});
