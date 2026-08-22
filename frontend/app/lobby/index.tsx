import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Workspace } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function LobbyWorkspaces() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    try { setList(await api.lobbyWorkspaces()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const w = await api.lobbyCreateWorkspace(name.trim(), desc.trim());
      setName(""); setDesc("");
      await load();
      router.push(`/lobby/${w.id}`);
    } catch (e: any) { Alert.alert("Couldn't create", e?.message || "Try again."); }
    finally { setCreating(false); }
  };

  const remove = (w: Workspace) => {
    Alert.alert("Delete workspace", `Delete "${w.name}" and remove all teammates?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.lobbyDeleteWorkspace(w.id); load(); } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="lobby-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Workspaces</Text>
          <Eyebrow>Entrepreneur Lobby</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.createBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.createTitle, { color: colors.onSurface }]}>New business workspace</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Workspace name" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="ws-name" />
          <TextInput value={desc} onChangeText={setDesc} placeholder="What's it for? (optional)" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="ws-desc" />
          <Pressable onPress={create} disabled={!name.trim() || creating} style={[styles.createBtn, { backgroundColor: name.trim() ? colors.brand : colors.surfaceTertiary }]} testID="ws-create">
            <MaterialCommunityIcons name="plus" size={18} color={name.trim() ? colors.onBrandPrimary : colors.muted} />
            <Text style={[styles.createBtnText, { color: name.trim() ? colors.onBrandPrimary : colors.muted }]}>{creating ? "Creating…" : "Create workspace"}</Text>
          </Pressable>
        </View>

        {loading ? (
          <Loading label="Loading your workspaces…" />
        ) : list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="office-building-outline" size={40} color={colors.muted} />
            <Text style={[styles.empty, { color: colors.muted }]}>No workspaces yet. Create one above to start building your team.</Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            {list.map((w) => (
              <Pressable key={w.id} onPress={() => router.push(`/lobby/${w.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`ws-card-${w.id}`}>
                <View style={[styles.cardIcon, { backgroundColor: `${colors.brand}22` }]}>
                  <MaterialCommunityIcons name="office-building" size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.onSurface }]} numberOfLines={1}>{w.name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>{w.member_count} {w.member_count === 1 ? "member" : "members"} · {w.is_owner ? "Owner" : "Member"}</Text>
                </View>
                {w.is_owner ? (
                  <Pressable onPress={() => remove(w)} hitSlop={10} testID={`ws-del-${w.id}`}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} />
                  </Pressable>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                )}
              </Pressable>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  createBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  createTitle: { fontFamily: fonts.bodyBold, fontSize: 15, marginBottom: spacing.md },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48, borderRadius: radius.md, marginTop: spacing.md },
  createBtnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  cardIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardName: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  cardMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
