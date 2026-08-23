import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, TGArticle } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function TelegraphDrafts() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<TGArticle[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setDrafts(await api.tgDrafts());
      setStatus("ready");
    } catch { setStatus("error"); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (id: string) => {
    Alert.alert("Delete draft?", "This draft will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await api.tgDeleteArticle(id); load(); } catch { /* ignore */ } } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="tg-drafts-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>My Drafts</Text>
          <Eyebrow>Unfinished pieces, saved for later</Eyebrow>
        </View>
        <Pressable testID="tg-drafts-new" onPress={() => router.push("/telegraph/new")} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="feather" size={19} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`tg-draft-${item.id}`} onPress={() => router.push(`/telegraph/new?id=${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardCat, { color: colors.brand }]}>{item.category.toUpperCase()}</Text>
              <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Text numberOfLines={2} style={[styles.cardExcerpt, { color: colors.muted }]}>{item.excerpt}</Text>
            </View>
            <Pressable onPress={() => remove(item.id)} hitSlop={10} testID={`tg-draft-delete-${item.id}`}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Fetching your drafts…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="file-document-edit-outline" title="No drafts yet" subtitle="Start writing and tap Save draft to keep it here until it's ready." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  cardCat: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4 },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 22, marginTop: 3 },
  cardExcerpt: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
});
