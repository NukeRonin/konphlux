import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SavesResponse } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, Loading } from "@/src/components/States";
import { Panel } from "@/src/components/Panel";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Tab = "listing" | "post" | "district";

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "listing", label: "Wares", icon: "storefront-outline" },
  { key: "post", label: "Dispatches", icon: "message-text-outline" },
  { key: "district", label: "Districts", icon: "compass-outline" },
];

export default function SavedScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<SavesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [tab, setTab] = useState<Tab>("listing");

  const load = useCallback(async () => {
    try {
      const res = await api.getSaves();
      setData(res);
    } finally {
      setStatus("ready");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="saved-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Saved</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count =
            t.key === "listing"
              ? data?.listings.length ?? 0
              : t.key === "post"
                ? data?.posts.length ?? 0
                : data?.districts.length ?? 0;
          return (
            <Pressable
              key={t.key}
              testID={`saved-tab-${t.key}`}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && { borderBottomColor: colors.brand, borderBottomWidth: 2 }]}
            >
              <MaterialCommunityIcons name={t.icon} size={18} color={active ? colors.brand : colors.muted} />
              <Text style={[styles.tabLabel, { color: active ? colors.onSurface : colors.muted, fontFamily: active ? fonts.bodyBold : fonts.bodyMedium }]}>
                {t.label} {count > 0 ? `(${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {status === "loading" ? (
        <Loading label="Fetching your keepsakes…" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "listing" &&
            (data && data.listings.length > 0 ? (
              data.listings.map((l) => (
                <Pressable key={l.id} testID={`saved-listing-${l.id}`} onPress={() => router.push(`/product/${l.id}`)}>
                  <Panel style={styles.row} padded={false}>
                    <Image source={{ uri: l.image }} style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                    <View style={styles.rowBody}>
                      <Eyebrow>{l.category}</Eyebrow>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.onSurface }]}>{l.title}</Text>
                      <Text style={[styles.rowPrice, { color: colors.brandSecondary }]}>{formatPrice(l.price_cents)}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} style={{ marginRight: spacing.sm }} />
                  </Panel>
                </Pressable>
              ))
            ) : (
              <EmptyState icon="storefront-outline" title="No saved wares yet" subtitle="Tap the bookmark on any Bazaar listing to keep it here." />
            ))}

          {tab === "post" &&
            (data && data.posts.length > 0 ? (
              data.posts.map((p) => (
                <Panel key={p.id} style={{ marginBottom: spacing.md }} testID={`saved-post-${p.id}`}>
                  <Text style={[styles.postAuthor, { color: colors.onSurface }]}>{p.author}</Text>
                  <Text style={[styles.postMeta, { color: colors.muted }]}>{p.kind} · {p.time}</Text>
                  <Text style={[styles.postBody, { color: colors.onSurface }]}>{p.body}</Text>
                  <Text style={[styles.postMeta, { color: colors.muted, marginTop: spacing.sm }]}>
                    ♥ {compactNumber(p.likes)}
                  </Text>
                </Panel>
              ))
            ) : (
              <EmptyState icon="message-text-outline" title="No saved dispatches" subtitle="Bookmark a post in your feed to keep it here." />
            ))}

          {tab === "district" &&
            (data && data.districts.length > 0 ? (
              data.districts.map((d) => (
                <Pressable key={d.slug} testID={`saved-district-${d.slug}`} onPress={() => router.push(`/district/${d.slug}`)}>
                  <Panel style={styles.row}>
                    <View style={[styles.dIcon, { backgroundColor: colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons name={d.icon as IconName} size={22} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.onSurface }]}>{d.name}</Text>
                      <Text numberOfLines={1} style={[styles.postMeta, { color: colors.muted }]}>{d.tagline}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
                  </Panel>
                </Pressable>
              ))
            ) : (
              <EmptyState icon="compass-outline" title="No favourite districts" subtitle="Tap the star on any district to keep it here." />
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontFamily: fonts.display, fontSize: 20 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  tabLabel: { fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, overflow: "hidden" },
  thumb: { width: 76, height: 76 },
  rowBody: { flex: 1, gap: 2, paddingVertical: spacing.sm },
  rowTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  rowPrice: { fontFamily: fonts.bodyBold, fontSize: 15 },
  dIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  postAuthor: { fontFamily: fonts.displaySemi, fontSize: 15 },
  postMeta: { fontFamily: fonts.body, fontSize: 12 },
  postBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
});
