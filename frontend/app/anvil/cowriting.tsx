import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AnvilWork } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function CoWriting() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AnvilWork[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setItems(await api.anvilCowriting());
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

  const renderItem = ({ item }: { item: AnvilWork }) => (
    <Pressable
      testID={`cowrite-${item.id}`}
      onPress={() => router.push(`/anvil/work/${item.id}`)}
      style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
        <Text numberOfLines={2} style={[styles.excerpt, { color: colors.muted }]}>{item.excerpt}</Text>
        <Text style={[styles.meta, { color: colors.aether }]}>
          {item.contribution_count} {item.contribution_count === 1 ? "passage" : "passages"} · by {item.author}
        </Text>
      </View>
      <MaterialCommunityIcons name="pencil-plus" size={20} color={colors.brand} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="cowriting-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Co-writing</Text>
          <Eyebrow>Works open for your pen</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Finding open works…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="account-multiple-outline" title="Nothing open yet" subtitle="When authors open a work for co-writing, it'll appear here." />}
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  title: { fontFamily: fonts.displaySemi, fontSize: 16 },
  excerpt: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  meta: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 4 },
});
