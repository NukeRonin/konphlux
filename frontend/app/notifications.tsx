import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AppNotification } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing, timeAgo } from "@/src/theme/tokens";

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  outbid: "gavel",
};

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const list = await api.notifications();
      setItems(list);
      setStatus("ready");
      if (list.some((n) => !n.read)) api.markNotificationsRead().catch(() => {});
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      testID={`notif-${item.id}`}
      onPress={() => item.listing_id && router.push(`/product/${item.listing_id}`)}
      style={[styles.row, { backgroundColor: item.read ? colors.surfaceSecondary : colors.surfaceTertiary, borderColor: colors.border }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name={ICONS[item.type] ?? "bell"} size={20} color={colors.brandSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{item.body}</Text>
        <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(item.created_at)}</Text>
      </View>
      {item.listing_id ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} /> : null}
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="notif-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Notifications</Text>
          <Eyebrow>Bids, sparks & alerts</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Checking the telegraph…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="bell-outline" title="No notifications yet" subtitle="Bid on an auction and we'll tell you if you're outbid." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  time: { fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
});
