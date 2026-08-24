import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, UserProfile } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const REL_LABEL: Record<string, string> = {
  friends: "Friends", outgoing: "Request sent", incoming: "Wants to be friends",
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setStatus("loading"); setProfile(await api.userProfile(id)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>) => {
    if (!id || busy) return;
    setBusy(true);
    try { await fn(); setProfile(await api.userProfile(id)); } catch { /* ignore */ } finally { setBusy(false); }
  };

  const rel = profile?.relation ?? "none";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="user-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Profile</Text>
          <Eyebrow>Konphlux member</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Opening profile…" />
      ) : status === "error" || !profile ? (
        <ErrorState onRetry={load} />
      ) : (
        <View style={styles.body}>
          <AvatarInitials name={profile.display_name} size={96} />
          <Text style={[styles.name, { color: colors.onSurface }]}>{profile.display_name}</Text>
          {profile.handle ? <Text style={[styles.handle, { color: colors.muted }]}>{profile.handle}</Text> : null}
          <Text style={[styles.count, { color: colors.muted }]}>{profile.friend_count} friend{profile.friend_count === 1 ? "" : "s"}</Text>

          {rel !== "none" && rel !== "self" ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name={rel === "friends" ? "account-check" : rel === "incoming" ? "account-clock" : "account-arrow-right"} size={15} color={colors.brand} />
              <Text style={[styles.statusText, { color: colors.onSurface }]}>{REL_LABEL[rel]}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {busy ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
            ) : rel === "self" ? (
              <Text style={[styles.selfNote, { color: colors.muted }]}>This is you.</Text>
            ) : rel === "none" ? (
              <Pressable testID="user-add" onPress={() => act(() => api.friendRequest(profile.id))} style={[styles.primaryBtn, { backgroundColor: colors.brand }]}>
                <MaterialCommunityIcons name="account-plus" size={18} color={colors.onBrandPrimary} />
                <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Send friend request</Text>
              </Pressable>
            ) : rel === "outgoing" ? (
              <Pressable testID="user-cancel" onPress={() => act(() => api.friendRemove(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.outlineText, { color: colors.muted }]}>Cancel request</Text>
              </Pressable>
            ) : rel === "incoming" ? (
              <View style={styles.dualRow}>
                <Pressable testID="user-accept" onPress={() => act(() => api.friendAccept(profile.id))} style={[styles.primaryBtn, { backgroundColor: colors.brand, flex: 1 }]}>
                  <MaterialCommunityIcons name="check" size={18} color={colors.onBrandPrimary} />
                  <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Accept</Text>
                </Pressable>
                <Pressable testID="user-reject" onPress={() => act(() => api.friendDecline(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}>
                  <Text style={[styles.outlineText, { color: colors.muted }]}>Reject</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable testID="user-unfriend" onPress={() => act(() => api.friendRemove(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <MaterialCommunityIcons name="account-remove-outline" size={17} color={colors.muted} />
                <Text style={[styles.outlineText, { color: colors.muted }]}>Remove friend</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  body: { alignItems: "center", padding: spacing.xl, gap: spacing.xs },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md },
  handle: { fontFamily: fonts.body, fontSize: 14 },
  count: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  actions: { width: "100%", marginTop: spacing.lg },
  dualRow: { flexDirection: "row", gap: spacing.sm },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 50, borderRadius: radius.md },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 50, borderRadius: radius.md, borderWidth: 1 },
  outlineText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  selfNote: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: spacing.md },
});
