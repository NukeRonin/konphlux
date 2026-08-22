import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl, PSProject } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function PSProjects() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PSProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await api.psProjects());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (p: PSProject) => {
    Alert.alert("Delete project", `Remove "${p.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.psDeleteProject(p.id); load(); } },
    ]);
  };

  const tagCount = (p: PSProject) =>
    (p.transitions?.length || 0) + (p.atmospherics?.length || 0) + (p.titles?.length || 0) + (p.finishing?.length || 0) + (p.audio_effects?.length || 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psp-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>My Projects</Text>
          <Eyebrow>Saved AI video concepts</Eyebrow>
        </View>
        <Pressable testID="psp-new" onPress={() => router.push("/pictureshow/ai")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="plus" size={22} color={colors.brand} />
        </Pressable>
      </View>

      {loading ? (
        <Loading label="Opening your projects…" />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="movie-open-outline" size={40} color={colors.muted} />
          <Text style={[styles.empty, { color: colors.muted }]}>No saved projects yet. Generate a concept in the AI Video Suite and tap Save to Projects.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {items.map((p) => (
            <Pressable key={p.id} testID={`psp-open-${p.id}`} onPress={() => router.push(`/pictureshow/ai?project=${p.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {p.poster_path ? (
                <Image source={{ uri: fileUrl(p.poster_path) }} style={styles.poster} contentFit="cover" transition={200} />
              ) : (
                <View style={[styles.poster, styles.posterFallback, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={p.kind === "animation" ? "animation-play" : "movie-filter"} size={28} color={colors.muted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={[styles.kindBadge, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={[styles.kindText, { color: colors.brand }]}>{p.kind === "animation" ? "Animation" : "Video"}</Text>
                  </View>
                  <Pressable onPress={() => remove(p)} hitSlop={10} testID={`psp-del-${p.id}`}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} />
                  </Pressable>
                </View>
                <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{p.title}</Text>
                <Text numberOfLines={2} style={[styles.desc, { color: colors.muted }]}>{p.prompt}</Text>
                <View style={styles.metaRow}>
                  {p.style ? <Text style={[styles.meta, { color: colors.brand }]}>{p.style}</Text> : null}
                  {p.length ? <Text style={[styles.meta, { color: colors.muted }]}>· {p.length}</Text> : null}
                  {tagCount(p) > 0 ? <Text style={[styles.meta, { color: colors.muted }]}>· {tagCount(p)} effects</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.meta, { color: colors.muted }]}>{fmtDate(p.created_at)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
  card: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  poster: { width: 108, height: 108 },
  posterFallback: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, padding: spacing.md, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  kindText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  title: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  desc: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11.5 },
});
