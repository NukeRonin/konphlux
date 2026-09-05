import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Panel } from "@/src/components/Panel";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { storage } from "@/src/utils/storage";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const PREF_KEYS = {
  notifUpdates: "settings.notif.updates",
  notifComments: "settings.notif.comments",
  notifMarketing: "settings.notif.marketing",
  privacyProfile: "settings.privacy.publicProfile",
  privacyActivity: "settings.privacy.showActivity",
} as const;

function Row({ icon, label, sub, right, onPress, testID, danger }: { icon: IconName; label: string; sub?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; danger?: boolean }) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <MaterialCommunityIcons name={icon} size={18} color={danger ? (colors.error ?? colors.brand) : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: danger ? (colors.error ?? colors.onSurface) : colors.onSurface }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.muted }]}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} /> : null)}
    </View>
  );
  if (onPress) return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{ backgroundColor: pressed ? colors.surfaceTertiary : "transparent" }]}>{content}</Pressable>;
  return content;
}

export default function Settings() {
  const { colors, mode, toggle } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [dating, setDating] = useState<{ visible: boolean; men: boolean; women: boolean }>({ visible: true, men: true, women: true });

  const loadPrefs = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(PREF_KEYS).map(async ([k, key]) => [k, (await storage.getItem(key, true)) as boolean] as const),
    );
    setPrefs(Object.fromEntries(entries));
    try {
      const me = await api.datingMe();
      if (me) setDating({ visible: me.visible !== false, men: (me.seeking || []).includes("man"), women: (me.seeking || []).includes("woman") });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const saveDating = async (next: { visible: boolean; men: boolean; women: boolean }) => {
    setDating(next);
    const seeking = [next.men ? "man" : null, next.women ? "woman" : null].filter(Boolean) as string[];
    try { await api.datingPreferences({ visible: next.visible, seeking }); } catch { /* ignore */ }
  };

  const setPref = async (k: keyof typeof PREF_KEYS, v: boolean) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    await storage.setItem(PREF_KEYS[k], v);
  };

  const sw = (k: keyof typeof PREF_KEYS) => (
    <Switch value={prefs[k] ?? true} onValueChange={(v) => setPref(k, v)} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surfaceSecondary} testID={`pref-${k}`} />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="settings-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Settings</Text>
          <Eyebrow>Tune your Konphlux</Eyebrow>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Eyebrow style={styles.groupLabel}>Appearance</Eyebrow>
        <Panel padded={false}>
          <Row icon={mode === "dark" ? "weather-night" : "white-balance-sunny"} label="Lamplight mode" sub={mode === "dark" ? "Dark wood & aether glow" : "Warm parchment"} right={<Switch value={mode === "dark"} onValueChange={toggle} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surfaceSecondary} testID="settings-theme" />} />
        </Panel>

        <Eyebrow style={styles.groupLabel}>Notifications</Eyebrow>
        <Panel padded={false}>
          <Row icon="bell-ring-outline" label="Fundraiser updates" sub="When projects you back post news" right={sw("notifUpdates")} />
          <Divider />
          <Row icon="comment-text-outline" label="Comments & replies" sub="Replies to your comments" right={sw("notifComments")} />
          <Divider />
          <Row icon="bullhorn-outline" label="News & offers" sub="Occasional product news" right={sw("notifMarketing")} />
        </Panel>

        <Eyebrow style={styles.groupLabel}>Privacy</Eyebrow>
        <Panel padded={false}>
          <Row icon="account-eye-outline" label="Public profile" sub="Let others view your Konphlux ID" right={sw("privacyProfile")} />
          <Divider />
          <Row icon="pulse" label="Show activity" sub="Display your posts & backings" right={sw("privacyActivity")} />
        </Panel>

        <Eyebrow style={styles.groupLabel}>Sparking Dawn Privacy</Eyebrow>
        <Panel padded={false}>
          <Row icon="heart-flash" label="Make Profile Visible in Sparking Dawn" sub="Choose when you're active in the dating pool" right={<Switch value={dating.visible} onValueChange={(v) => saveDating({ ...dating, visible: v })} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surfaceSecondary} testID="dating-visible" />} />
          <Divider />
          <Row icon="gender-male" label="I'm interested in Men" sub="Show men in your dating pool" right={<Switch value={dating.men} onValueChange={(v) => saveDating({ ...dating, men: v })} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surfaceSecondary} testID="dating-men" />} />
          <Divider />
          <Row icon="gender-female" label="I'm interested in Women" sub="Show women in your dating pool" right={<Switch value={dating.women} onValueChange={(v) => saveDating({ ...dating, women: v })} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surfaceSecondary} testID="dating-women" />} />
        </Panel>

        <Eyebrow style={styles.groupLabel}>Account & security</Eyebrow>
        <Panel padded={false}>
          <Row icon="bookmark-multiple-outline" label="Bookmarks" onPress={() => router.push("/saved")} testID="settings-bookmarks" />
          <Divider />
          <Row icon="bookshelf" label="Library" sub="Your downloaded eBooks" onPress={() => router.push("/library")} testID="settings-library" />
          <Divider />
          <Row icon="receipt" label="My Orders" onPress={() => router.push("/orders")} testID="settings-orders" />
          <Divider />
          <Row icon="hand-heart-outline" label="My Backings" onPress={() => router.push("/dreambacker/backings")} testID="settings-backings" />
          <Divider />
          <Row icon="lock-check" label="Account security" sub="Managed with your Konphlux login" onPress={() => Alert.alert("Account security", "Your session is secured with an encrypted token on this device. To change your password, sign out and use 'Forgot password' on the login screen.")} testID="settings-security" />
          <Divider />
          <Row icon="trash-can-outline" label="Delete account" sub="Permanently remove your account & data" danger onPress={() => router.push("/delete-account")} testID="settings-delete-account" />
        </Panel>

        <Eyebrow style={styles.groupLabel}>Assistance</Eyebrow>
        <Panel padded={false}>
          <Row icon="lifebuoy" label="Help Center" sub="FAQs & guides" onPress={() => Alert.alert("Help Center", "Browse districts from the home screen. Tap any district to see what it offers. For fundraisers, open Dreambacker; for the marketplace, open Bazaar.")} testID="settings-help" />
          <Divider />
          <Row icon="face-agent" label="Contact support" sub="support@konphlux.app" onPress={() => Linking.openURL("mailto:support@konphlux.app?subject=Konphlux%20Support")} testID="settings-support" />
          <Divider />
          <Row icon="email-edit-outline" label="Contact Us" sub="Send us a message" onPress={() => router.push("/contact")} testID="settings-contact" />
          <Divider />
          <Row icon="shield-lock-outline" label="Privacy Policy" sub="How we handle your data" onPress={() => router.push("/privacy")} testID="settings-privacy" />
          <Divider />
          <Row icon="file-document-outline" label="Terms of Service" sub="The rules of the realm" onPress={() => router.push("/terms")} testID="settings-terms" />
        </Panel>

        <Eyebrow style={styles.groupLabel}>About</Eyebrow>
        <Panel padded={false}>
          <Row icon="information-outline" label="Konphlux" sub="Est. in the age of steam & signal · v1.0" onPress={() => router.push("/about")} testID="settings-about" />
          <Divider />
          <Row icon="gesture-swipe-horizontal" label="Replay the tour" sub="See the welcome walkthrough again" onPress={() => router.push("/onboarding")} testID="settings-replay-tour" />
        </Panel>

        <ForgeButton label="Sign out of Konphlux" variant="outline" fullWidth style={{ marginTop: spacing.xl }} testID="settings-signout" onPress={signOut} icon={<MaterialCommunityIcons name="logout" size={16} color={colors.brand} />} />
      </ScrollView>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  groupLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  rowSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
