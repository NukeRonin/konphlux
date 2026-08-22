import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CBUser } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function NewGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<CBUser[]>([]);
  const [selected, setSelected] = useState<CBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
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

  const toggle = (u: CBUser) => {
    setSelected((s) => (s.find((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));
  };

  const create = async () => {
    if (title.trim().length < 2) return setError("Name your group.");
    if (selected.length < 1) return setError("Add at least one member.");
    setBusy(true);
    setError("");
    try {
      const conv = await api.cbCreateGroup(title.trim(), selected.map((u) => u.id));
      router.replace(`/chatterbox/conversation/${conv.id}`);
    } catch {
      setError("Couldn't create the group. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="group-back">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>New group chat</Text>
          <Eyebrow>Gather your circle</Eyebrow>
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <TextInput testID="group-title" value={title} onChangeText={setTitle} placeholder="Group name" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
            {selected.length > 0 ? (
              <FlatList
                horizontal
                data={selected}
                keyExtractor={(u) => u.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <Pressable testID={`group-remove-${item.id}`} onPress={() => toggle(item)} style={styles.selChip}>
                    <Image source={{ uri: item.avatar }} style={styles.selAvatar} contentFit="cover" />
                    <Text numberOfLines={1} style={[styles.selName, { color: colors.onSurface }]}>{item.display_name.split(" ")[0]}</Text>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} />
                  </Pressable>
                )}
              />
            ) : null}
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
              <TextInput testID="group-search" value={q} onChangeText={setQ} placeholder="Add people…" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.searchInput, { color: colors.onSurface }]} />
            </View>
            {loading ? <Loading label="Finding people…" /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const on = !!selected.find((x) => x.id === item.id);
          return (
            <Pressable testID={`group-user-${item.id}`} onPress={() => toggle(item)} style={styles.row}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.onSurface }]}>{item.display_name}</Text>
                <Text style={[styles.handle, { color: colors.muted }]}>{item.handle}</Text>
              </View>
              <View style={[styles.check, { borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : "transparent" }]}>
                {on ? <MaterialCommunityIcons name="check" size={16} color={colors.onBrandPrimary} /> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface }]}>
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={`Create group${selected.length ? ` (${selected.length})` : ""}`} fullWidth loading={busy} onPress={create} testID="group-create" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, flexGrow: 1 },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  selChip: { alignItems: "center", width: 60, gap: 2 },
  selAvatar: { width: 46, height: 46, borderRadius: 23 },
  selName: { fontFamily: fonts.bodyMedium, fontSize: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15 },
  handle: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginBottom: spacing.sm },
});
