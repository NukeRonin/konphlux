import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SparkCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function LikedProfiles() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SparkCard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try { setStatus("loading"); setItems(await api.datingLikes()); setStatus("ready"); }
    catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }: { item: SparkCard }) => (
    <Pressable testID={`liked-${item.id}`} onPress={() => router.push(`/sparking-dawn/spark/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      {item.photo ? <Image source={{ uri: item.photo }} style={[styles.photo, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" /> : <View style={[styles.photo, { backgroundColor: colors.surfaceTertiary }]} />}
      {item.matched ? (
        <View style={[styles.badge, { backgroundColor: colors.brandSecondary }]}>
          <MaterialCommunityIcons name="heart" size={11} color={colors.onBrandPrimary} />
          <Text style={[styles.badgeText, { color: colors.onBrandPrimary }]}>Matched</Text>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <MaterialCommunityIcons name="clock-outline" size={11} color="#fff" />
          <Text style={[styles.badgeText, { color: "#fff" }]}>Pending</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.display_name}{item.age ? `, ${item.age}` : ""}</Text>
        {item.tagline ? <Text numberOfLines={1} style={[styles.tagline, { color: colors.muted }]}>{item.tagline}</Text> : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="liked-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Liked Profiles</Text>
          <Eyebrow>People you've sparked with</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Gathering your likes…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xxxl }}>
              <EmptyState icon="heart-outline" title="No likes yet" subtitle="Swipe right on people in Sparking Dawn and they'll show up here." />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { flex: 1, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  photo: { width: "100%", height: 180 },
  badge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, height: 22, paddingHorizontal: 8, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  info: { padding: spacing.md },
  name: { fontFamily: fonts.displaySemi, fontSize: 15 },
  tagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
