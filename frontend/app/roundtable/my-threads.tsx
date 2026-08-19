import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Thread } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { ThreadRow } from "@/src/components/ThreadRow";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

export default function MyThreads() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setThreads(await api.rtMyThreads());
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
        <Pressable onPress={() => router.back()} hitSlop={12} testID="my-threads-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Discussions I Started</Text>
          <Eyebrow>Threads authored by you</Eyebrow>
        </View>
        <Pressable
          testID="my-threads-new"
          onPress={() => router.push("/roundtable/new-thread")}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="feather" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Fetching your threads…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <ThreadRow thread={item} onVoted={onVoted} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="feather"
              title="No discussions yet"
              subtitle="Start a thread and it will show up here."
            />
          }
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
  list: { padding: spacing.lg, flexGrow: 1 },
});
