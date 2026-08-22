import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Workspace } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function WorkspaceDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setWs(await api.lobbyWorkspace(id)); } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addMember = async () => {
    if (!id || !recipient.trim() || adding) return;
    setAdding(true);
    try {
      await api.lobbyAddMember(id, recipient.trim());
      setRecipient("");
      await load();
    } catch (e: any) { Alert.alert("Couldn't add teammate", e?.message || "Try again."); }
    finally { setAdding(false); }
  };

  const removeMember = (memberId: string, name: string) => {
    if (!id) return;
    Alert.alert("Remove teammate", `Remove ${name} from this workspace?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { try { await api.lobbyRemoveMember(id, memberId); load(); } catch (e: any) { Alert.alert("Couldn't remove", e?.message || "Try again."); } } },
    ]);
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Loading…" /></View>;
  if (!ws) return <View style={[styles.screen, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: colors.muted, fontFamily: fonts.body }}>Workspace not found.</Text></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="wsd-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{ws.name}</Text>
          <Eyebrow>{ws.member_count} {ws.member_count === 1 ? "member" : "members"}</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {ws.description ? <Text style={[styles.desc, { color: colors.muted }]}>{ws.description}</Text> : null}

        {ws.is_owner ? (
          <View style={[styles.addBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.addTitle, { color: colors.onSurface }]}>Add a teammate</Text>
            <View style={styles.addRow}>
              <TextInput value={recipient} onChangeText={setRecipient} placeholder="Email or @handle" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="wsd-recipient" onSubmitEditing={addMember} returnKeyType="done" />
              <Pressable onPress={addMember} disabled={!recipient.trim()} style={[styles.addBtn, { backgroundColor: recipient.trim() ? colors.brand : colors.surfaceTertiary }]} testID="wsd-add">
                <MaterialCommunityIcons name="account-plus" size={20} color={recipient.trim() ? colors.onBrandPrimary : colors.muted} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <Eyebrow style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>My Team</Eyebrow>
        {ws.members.map((m) => (
          <View key={m.user_id} style={[styles.member, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}>
              <Text style={[styles.avatarText, { color: colors.brand }]}>{(m.name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memberName, { color: colors.onSurface }]} numberOfLines={1}>{m.name}</Text>
              {m.handle ? <Text style={[styles.memberHandle, { color: colors.muted }]}>{m.handle}</Text> : null}
            </View>
            <View style={[styles.roleTag, { backgroundColor: m.role === "owner" ? colors.brand : colors.surfaceTertiary }]}>
              <Text style={[styles.roleText, { color: m.role === "owner" ? colors.onBrandPrimary : colors.muted }]}>{m.role === "owner" ? "Owner" : "Member"}</Text>
            </View>
            {ws.is_owner && m.role !== "owner" ? (
              <Pressable onPress={() => removeMember(m.user_id, m.name)} hitSlop={10} style={{ marginLeft: spacing.sm }} testID={`wsd-remove-${m.user_id}`}>
                <MaterialCommunityIcons name="account-remove-outline" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  addBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  addTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, marginBottom: spacing.sm },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  member: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.displaySemi, fontSize: 16 },
  memberName: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  memberHandle: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  roleTag: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  roleText: { fontFamily: fonts.bodyBold, fontSize: 11 },
});
