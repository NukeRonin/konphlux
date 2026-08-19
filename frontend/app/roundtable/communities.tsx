import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Community } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";
import { storage } from "@/src/utils/storage";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Filter = "all" | "joined" | "recent";

const RECENT_KEY = "rt_recent_communities";

const COPY: Record<Filter, { title: string; sub: string; emptyTitle: string; emptySub: string; emptyIcon: IconName }> = {
  all: {
    title: "Browse Communities",
    sub: "Every chamber at the table",
    emptyTitle: "No communities yet",
    emptySub: "Be the first to found one.",
    emptyIcon: "account-group-outline",
  },
  joined: {
    title: "Joined Communities",
    sub: "Chambers you belong to",
    emptyTitle: "You haven't joined any",
    emptySub: "Browse communities and tap Join to see them here.",
    emptyIcon: "account-check-outline",
  },
  recent: {
    title: "Recently Visited",
    sub: "Chambers you opened lately",
    emptyTitle: "Nothing visited yet",
    emptySub: "Open a community and it will appear here.",
    emptyIcon: "history",
  },
};

function CommunityRow({ community }: { community: Community }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`community-${community.id}`}
      onPress={() => router.push(`/roundtable/community/${community.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient
        colors={colors.brassGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.icon, { borderColor: colors.brandSecondary }]}
      >
        <MaterialCommunityIcons name={community.icon as IconName} size={24} color={colors.onBrandPrimary} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{community.name}</Text>
          {community.member ? (
            <View style={[styles.badge, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="check" size={12} color={colors.brand} />
              <Text style={[styles.badgeText, { color: colors.brand }]}>Joined</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.desc, { color: colors.muted }]}>{community.description}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {compactNumber(community.members)} members · {community.thread_count} threads
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
    </Pressable>
  );
}

export default function CommunitiesList() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const filter: Filter = filterParam === "joined" || filterParam === "recent" ? filterParam : "all";
  const copy = COPY[filter];
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Community[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      if (filter === "recent") {
        const ids = (await storage.getItem<string[]>(RECENT_KEY, [])) ?? [];
        const all = await api.rtCommunities();
        const byId = new Map(all.map((c) => [c.id, c]));
        setItems(ids.map((id) => byId.get(id)).filter((c): c is Community => !!c));
      } else {
        setItems(await api.rtCommunities(filter === "joined" ? "joined" : undefined));
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="communities-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{copy.title}</Text>
          <Eyebrow>{copy.sub}</Eyebrow>
        </View>
        <Pressable
          testID="communities-create"
          onPress={() => router.push("/roundtable/new-community")}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="account-multiple-plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Gathering the chambers…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CommunityRow community={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon={copy.emptyIcon} title={copy.emptyTitle} subtitle={copy.emptySub} />}
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
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  icon: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontFamily: fonts.displaySemi, fontSize: 16, flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
});
