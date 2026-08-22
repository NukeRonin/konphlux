import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSChannel } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSChannels() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<PSChannel[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setChannels(await api.psChannels());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSub = async (id: string) => {
    const res = await api.psSubscribe(id);
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, subscribed: res.subscribed, subscribers: c.subscribers + (res.subscribed ? 1 : -1) } : c)));
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="pschannels-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Channels</Text>
          <Eyebrow>Follow the makers</Eyebrow>
        </View>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable testID={`pschannel-${item.id}`} onPress={() => router.push(`/pictureshow/channel/${item.id}`)} style={styles.rowMain}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.name}</Text>
                <Text style={[styles.subs, { color: colors.muted }]}>{compactNumber(item.subscribers)} subs · {item.video_count ?? 0} videos</Text>
              </View>
            </Pressable>
            <Pressable testID={`pschannel-sub-${item.id}`} onPress={() => toggleSub(item.id)} style={[styles.subBtn, { backgroundColor: item.subscribed ? colors.surfaceTertiary : colors.brand, borderColor: colors.brand }]}>
              <Text style={[styles.subText, { color: item.subscribed ? colors.brand : colors.onBrandPrimary }]}>{item.subscribed ? "Following" : "Subscribe"}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={status === "loading" ? <Loading label="Gathering channels…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="account-group" title="No channels yet" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15 },
  subs: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  subBtn: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
