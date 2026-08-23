import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroBusiness } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { Stars } from "@/src/components/RetroStars";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

export default function FavoritePlaces() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<RetroBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setList(await api.retroFavorites()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unfav = async (b: RetroBusiness) => {
    setList((prev) => prev.filter((x) => x.id !== b.id));
    try { await api.retroRemoveFavorite(b.id); } catch { load(); }
  };

  const remind = async (b: RetroBusiness) => {
    setList((prev) => prev.map((x) => x.id === b.id ? { ...x, reminding: !x.reminding } : x));
    try { await api.retroReopenReminder(b.id); } catch { load(); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="fav-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Favorite Places</Text>
          <Eyebrow>Your saved spots</Eyebrow>
        </View>
      </View>

      {loading ? (
        <Loading label="Loading favorites…" />
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="heart-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>No favorites yet. Tap the heart on any business to save it here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {list.map((b) => {
            const m = catMeta(b.category);
            return (
              <Pressable key={b.id} onPress={() => router.push(`/retrospections/business/${b.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`fav-${b.id}`}>
                {b.image ? (
                  <Image source={{ uri: b.image }} style={styles.img} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.img, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialCommunityIcons name={m.icon} size={24} color={m.color} />
                  </View>
                )}
                <View style={{ flex: 1, padding: spacing.md }}>
                  <View style={[styles.catPill, { backgroundColor: `${m.color}22`, alignSelf: "flex-start" }]}>
                    <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
                    <Text style={[styles.catText, { color: m.color }]}>{b.category}</Text>
                  </View>
                  <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{b.name}</Text>
                  {b.status === "temporary_closure" ? (
                    <View style={styles.reopenRow}>
                      <View style={styles.reopenPill}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={11} color="#B7791F" />
                        <Text style={styles.reopenText}>
                          {typeof b.reopen_in_days === "number"
                            ? (b.reopen_in_days <= 0 ? "Reopens today" : `Reopens in ${b.reopen_in_days} day${b.reopen_in_days === 1 ? "" : "s"}`)
                            : "Temporarily closed"}
                        </Text>
                      </View>
                      <Pressable
                        testID={`remind-${b.id}`}
                        onPress={() => remind(b)}
                        hitSlop={8}
                        style={[styles.remindBtn, { borderColor: b.reminding ? colors.brand : colors.border, backgroundColor: b.reminding ? colors.brand : "transparent" }]}
                      >
                        <MaterialCommunityIcons name={b.reminding ? "bell-check" : "bell-plus-outline"} size={12} color={b.reminding ? colors.onBrandPrimary : colors.brand} />
                        <Text style={[styles.remindText, { color: b.reminding ? colors.onBrandPrimary : colors.brand }]}>{b.reminding ? "Reminding" : "Remind me"}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={styles.ratingRow}>
                    <Stars rating={b.avg_rating} />
                    <Text style={[styles.ratingText, { color: colors.onSurface }]}>{b.avg_rating.toFixed(1)}</Text>
                    <Text style={[styles.ratingCount, { color: colors.muted }]}>({b.review_count})</Text>
                  </View>
                </View>
                <Pressable onPress={() => unfav(b)} hitSlop={10} style={styles.heart} testID={`fav-remove-${b.id}`}>
                  <MaterialCommunityIcons name="heart" size={22} color="#E53E3E" />
                </Pressable>
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
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  img: { width: 90, height: 100 },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15.5, marginTop: 4 },
  reopenPill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "#FEF3C7", paddingHorizontal: 8, height: 20, borderRadius: radius.pill, marginTop: 4 },
  reopenText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: "#B7791F" },
  reopenRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginTop: 4 },
  remindBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, height: 22, borderRadius: radius.pill, borderWidth: 1 },
  remindText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  ratingCount: { fontFamily: fonts.body, fontSize: 12 },
  heart: { alignSelf: "center", paddingHorizontal: spacing.md },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
