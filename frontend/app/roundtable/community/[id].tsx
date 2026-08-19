import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Community, Thread } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { ThreadRow } from "@/src/components/ThreadRow";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";
import { storage } from "@/src/utils/storage";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const RECENT_KEY = "rt_recent_communities";

async function trackRecent(id: string) {
  const prev = (await storage.getItem<string[]>(RECENT_KEY, [])) ?? [];
  const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
  await storage.setItem(RECENT_KEY, next);
}

export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [community, setCommunity] = useState<Community | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.rtCommunity(id);
      setCommunity(res);
      setStatus("ready");
      trackRecent(id);
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleJoin = async () => {
    if (!community) return;
    setCommunity({ ...community, member: !community.member, members: community.members + (community.member ? -1 : 1) });
    try {
      await api.rtJoin(community.id);
    } catch {
      load();
    }
  };

  const onVoted = (t: Thread) =>
    setCommunity((prev) =>
      prev ? { ...prev, threads: prev.threads?.map((x) => (x.id === t.id ? t : x)) } : prev,
    );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="community-back" style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Opening the chamber…" />
      ) : status === "error" || !community ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={community.threads ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <ThreadRow thread={item} onVoted={onVoted} showCommunity={false} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <LinearGradient
                colors={colors.brassGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bigIcon, { borderColor: colors.brandSecondary }]}
              >
                <MaterialCommunityIcons name={community.icon as IconName} size={34} color={colors.onBrandPrimary} />
              </LinearGradient>
              <Text style={[styles.name, { color: colors.onSurface }]}>{community.name}</Text>
              <Text style={[styles.desc, { color: colors.muted }]}>{community.description}</Text>
              <Text style={[styles.stats, { color: colors.muted }]}>
                {compactNumber(community.members)} members · {community.thread_count} threads
              </Text>
              <View style={styles.actions}>
                <ForgeButton
                  label={community.member ? "Joined" : "Join community"}
                  variant={community.member ? "outline" : "forge"}
                  onPress={toggleJoin}
                  testID="join-btn"
                  icon={
                    <MaterialCommunityIcons
                      name={community.member ? "check" : "plus"}
                      size={16}
                      color={community.member ? colors.brand : colors.onBrandPrimary}
                    />
                  }
                />
                <ForgeButton
                  label="New thread"
                  variant="ghost"
                  onPress={() => router.push(`/roundtable/new-thread?community=${community.id}`)}
                  testID="community-new-thread"
                  icon={<MaterialCommunityIcons name="feather" size={16} color={colors.onSurface} />}
                />
              </View>
              <Eyebrow style={{ marginTop: spacing.lg }}>Threads</Eyebrow>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="forum-outline" title="No threads yet" subtitle="Be the first to start a discussion here." />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl },
  headerBlock: { marginBottom: spacing.md },
  bigIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md },
  desc: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  stats: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
});
