import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, DBProject } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { categoryMeta } from "@/src/utils/dreambacker";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Backing = DBProject & { your_total_cents: number; your_recurring: boolean; can_cancel_recurring: boolean };

export default function MyBackings() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Backing[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setItems(await api.dbMyBackings());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancelRecurring = (p: Backing) => {
    Alert.alert("Stop monthly support?", `Your monthly contribution to "${p.title}" will end. You won't be charged again.`, [
      { text: "Keep supporting", style: "cancel" },
      { text: "Stop", style: "destructive", onPress: async () => { try { await api.dbCancelRecurring(p.id); load(); } catch { /* ignore */ } } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="backings-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>My Backings</Text>
          <Eyebrow>Fundraisers you support</Eyebrow>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const cat = categoryMeta(item.category);
          return (
            <Pressable testID={`backing-${item.id}`} onPress={() => router.push(`/dreambacker/${item.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]}>
                {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.thumbImg} contentFit="cover" /> : <MaterialCommunityIcons name={cat.icon as IconName} size={24} color={colors.brand} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
                <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                  <View style={[styles.fill, { backgroundColor: colors.brand, width: `${Math.round(item.progress * 100)}%` }]} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.muted }]}>{Math.round(item.progress * 100)}% funded</Text>
                  <Text style={[styles.yours, { color: colors.brand }]}>You gave {formatPrice(item.your_total_cents)}{item.your_recurring ? "/mo" : ""}</Text>
                </View>
                {item.funded ? <Text style={[styles.funded, { color: colors.brand }]}>🎉 Goal reached</Text> : null}
                {item.can_cancel_recurring ? (
                  <Pressable testID={`backing-cancel-${item.id}`} onPress={() => cancelRecurring(item)} style={[styles.cancelBtn, { borderColor: colors.error ?? colors.muted }]}>
                    <MaterialCommunityIcons name="close-circle-outline" size={14} color={colors.error ?? colors.muted} />
                    <Text style={[styles.cancelText, { color: colors.error ?? colors.muted }]}>Stop monthly support</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Finding your dreams…" /> :
          status === "error" ? <ErrorState onRetry={load} /> :
          <EmptyState icon="hand-heart" title="No backings yet" subtitle="Back a fundraiser and it'll show up here with its progress." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { flexDirection: "row", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImg: { width: "100%", height: "100%" },
  title: { fontFamily: fonts.displaySemi, fontSize: 15 },
  track: { height: 7, borderRadius: 4, overflow: "hidden", marginTop: spacing.sm },
  fill: { height: 7, borderRadius: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  meta: { fontFamily: fonts.body, fontSize: 12 },
  yours: { fontFamily: fonts.bodyBold, fontSize: 12 },
  funded: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: 4 },
  cancelBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, marginTop: spacing.sm, height: 30, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
