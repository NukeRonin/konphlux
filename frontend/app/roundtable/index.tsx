import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Community, Thread } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { ThreadRow } from "@/src/components/ThreadRow";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function CommunityCard({ community }: { community: Community }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`community-${community.id}`}
      onPress={() => router.push(`/roundtable/community/${community.id}`)}
      style={({ pressed }) => [styles.commCard, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient
        colors={colors.brassGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.commIcon, { borderColor: colors.brandSecondary }]}
      >
        <MaterialCommunityIcons name={community.icon as IconName} size={24} color={colors.onBrandPrimary} />
      </LinearGradient>
      <View style={[styles.commBody, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <Text numberOfLines={1} style={[styles.commName, { color: colors.onSurface }]}>{community.name}</Text>
        <Text style={[styles.commMeta, { color: colors.muted }]}>
          {compactNumber(community.members)} members · {community.thread_count} threads
        </Text>
      </View>
    </Pressable>
  );
}

export default function RoundtableHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [c, t] = await Promise.all([api.rtCommunities(), api.rtThreads()]);
      setCommunities(c);
      setThreads(t);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onVoted = (t: Thread) => setThreads((prev) => prev.map((x) => (x.id === t.id ? t : x)));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="roundtable-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Roundtable</Text>
          <Eyebrow>Communities & discussions</Eyebrow>
        </View>
        <Pressable
          testID="new-community-btn"
          onPress={() => router.push("/roundtable/new-community")}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="account-multiple-plus" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Gathering the table…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <ThreadRow thread={item} onVoted={onVoted} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.rowHead}>
                <Eyebrow>Communities</Eyebrow>
                <Pressable onPress={() => router.push("/roundtable/new-community")} testID="create-community-link">
                  <Text style={[styles.link, { color: colors.brand }]}>+ Create</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commRow}>
                {communities.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </ScrollView>
              <View style={[styles.rowHead, { marginTop: spacing.lg }]}>
                <Eyebrow>Latest discussions</Eyebrow>
              </View>
            </View>
          }
        />
      )}

      <Pressable
        testID="new-thread-fab"
        onPress={() => router.push("/roundtable/new-thread")}
        style={[styles.fab, { bottom: insets.bottom + spacing.lg, borderColor: colors.brandSecondary }]}
      >
        <LinearGradient
          colors={colors.brassGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <MaterialCommunityIcons name="feather" size={18} color={colors.onBrandPrimary} />
          <Text style={[styles.fabText, { color: colors.onBrandPrimary }]}>New thread</Text>
        </LinearGradient>
      </Pressable>
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
  list: { padding: spacing.lg, paddingBottom: 110 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  link: { fontFamily: fonts.bodyBold, fontSize: 13 },
  commRow: { gap: spacing.md, paddingBottom: spacing.xs },
  commCard: { width: 190 },
  commIcon: {
    height: 60,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  commBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  commName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  commMeta: { fontFamily: fonts.body, fontSize: 11 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  fabInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, height: 50 },
  fabText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
