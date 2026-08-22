import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CBUser } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function NewMessage() {
  const params = useLocalSearchParams<{ call?: string }>();
  const isCall = params.call === "voice" || params.call === "video";
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<CBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.cbUsers(q);
        if (active) setUsers(res);
      } finally {
        if (active) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  const pick = async (u: CBUser) => {
    if (busy) return;
    if (isCall) {
      router.replace({ pathname: "/chatterbox/call", params: { name: u.display_name, avatar: u.avatar, mode: params.call } });
      return;
    }
    setBusy(true);
    try {
      const conv = await api.cbStartDm(u.id);
      router.replace(`/chatterbox/conversation/${conv.id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="new-back">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{isCall ? `New ${params.call} call` : "New message"}</Text>
          <Eyebrow>{isCall ? "Choose who to call" : "Choose who to message"}</Eyebrow>
        </View>
        {!isCall ? (
          <Pressable testID="new-group-shortcut" onPress={() => router.replace("/chatterbox/new-group")} style={[styles.groupBtn, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-multiple-plus" size={16} color={colors.brand} />
            <Text style={[styles.groupBtnText, { color: colors.brand }]}>Group</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput testID="new-search" value={q} onChangeText={setQ} placeholder="Search people…" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.searchInput, { color: colors.onSurface }]} />
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`new-user-${item.id}`} onPress={() => pick(item)} style={styles.row}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.onSurface }]}>{item.display_name}</Text>
              <Text style={[styles.handle, { color: colors.muted }]}>{item.handle}</Text>
            </View>
            {item.bot ? <View style={[styles.tag, { backgroundColor: colors.surfaceTertiary }]}><Text style={[styles.tagText, { color: colors.brand }]}>Contact</Text></View> : null}
            <MaterialCommunityIcons name={isCall ? (params.call === "video" ? "video" : "phone") : "chevron-right"} size={20} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={loading ? <Loading label="Finding people…" /> : <EmptyState icon="account-search" title="No one found" subtitle="Try a different name." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  groupBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  groupBtnText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15 },
  handle: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10 },
});
