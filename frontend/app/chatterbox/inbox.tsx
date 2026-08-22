import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CBConvSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ChatterboxInbox() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [convs, setConvs] = useState<CBConvSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [filter, setFilter] = useState<"all" | "dm" | "group">(params.filter === "group" ? "group" : "all");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.cbConversations();
      setConvs(res.conversations);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => (filter === "all" ? convs : convs.filter((c) => c.type === filter)), [convs, filter]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="inbox-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Inbox</Text>
          <Eyebrow>All your conversations</Eyebrow>
        </View>
        <Pressable testID="inbox-new-group" onPress={() => router.push("/chatterbox/new-group")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="account-multiple-plus" size={19} color={colors.brand} />
        </Pressable>
        <Pressable testID="inbox-new" onPress={() => router.push("/chatterbox/new")} style={[styles.iconBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          <MaterialCommunityIcons name="pencil" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {/* Filter */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(["all", "dm", "group"] as const).map((f) => (
          <Pressable key={f} testID={`inbox-filter-${f}`} onPress={() => setFilter(f)} style={[styles.filterChip, { borderColor: filter === f ? colors.brand : colors.border, backgroundColor: filter === f ? colors.surfaceTertiary : "transparent" }]}>
            <Text style={[styles.filterText, { color: filter === f ? colors.brand : colors.muted }]}>{f === "all" ? "All" : f === "dm" ? "Direct" : "Groups"}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`inbox-conv-${item.id}`} onPress={() => router.push(`/chatterbox/conversation/${item.id}`)} style={styles.row}>
            <View>
              <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
              {item.type === "group" ? (
                <View style={[styles.groupBadge, { backgroundColor: colors.brand, borderColor: colors.surface }]}>
                  <MaterialCommunityIcons name="account-multiple" size={10} color={colors.onBrandPrimary} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface, flex: 1 }]}>{item.title}</Text>
                <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(item.last_at)}</Text>
              </View>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={[styles.last, { color: item.unread ? colors.onSurface : colors.muted, flex: 1, fontFamily: item.unread ? fonts.bodyBold : fonts.body }]}>
                  {item.last_message || "No messages yet"}
                </Text>
                {item.unread > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                    <Text style={[styles.badgeText, { color: colors.onBrandPrimary }]}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Opening the inbox…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="message-outline" title="No conversations" subtitle="Tap the pencil to start a new message." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  filterChip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  list: { padding: spacing.lg, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  groupBadge: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  time: { fontFamily: fonts.body, fontSize: 11 },
  last: { fontSize: 13, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  sep: { height: 1, marginLeft: 68 },
});
