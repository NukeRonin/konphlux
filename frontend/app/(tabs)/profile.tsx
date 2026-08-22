import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { api, Profile } from "@/src/api/client";
import { AppHeader } from "@/src/components/AppHeader";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useAuth } from "@/src/auth/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, formatPrice, fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, mode, toggle } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      const res = await api.getProfile();
      setProfile(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMenu = (to: string) => {
    const routes: Record<string, string> = {
      bookmarks: "/saved",
      warehouse: "/orders",
      notifications: "/notifications",
      messages: "/chatterbox/inbox",
      achievements: "/achievements",
      dashboard: "/",
      settings: "/settings",
      privacy: "/settings",
      security: "/settings",
      appearance: "/settings",
      help: "/settings",
      support: "/settings",
      id: "/settings",
      resume: "/settings",
    };
    const dest = routes[to];
    if (dest) router.push(dest as never);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <AppHeader
        title="Headquarters"
        subtitle="Your Konphlux ID"
        actions={[{ icon: "cog-outline", onPress: () => router.push("/settings"), testID: "settings-btn" }]}
      />
      {status === "loading" ? (
        <Loading label="Opening your HQ…" />
      ) : status === "error" || !profile ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Konphlux ID card */}
          <Panel style={styles.idCard} testID="konphlux-id-card">
            {/* rivets */}
            <View style={[styles.rivet, styles.rivetTL, { backgroundColor: colors.brandPrimary }]} />
            <View style={[styles.rivet, styles.rivetTR, { backgroundColor: colors.brandPrimary }]} />
            <View style={styles.idHead}>
              <AvatarInitials name={profile.display_name} size={68} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.onSurface }]}>{profile.display_name}</Text>
                <Text style={[styles.handle, { color: colors.brand }]}>{profile.handle}</Text>
                <View style={[styles.titleBadge, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="shield-star" size={12} color={colors.brandSecondary} />
                  <Text style={[styles.titleText, { color: colors.onSurface }]}>{profile.title}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.bio, { color: colors.muted }]}>{profile.bio}</Text>
            <Hairline style={{ marginVertical: spacing.md }} />
            <View style={styles.statsRow}>
              <Stat label="Posts" value={compactNumber(profile.stats.posts)} />
              <Stat label="Followers" value={compactNumber(profile.stats.followers)} />
              <Stat label="Saved" value={compactNumber(profile.stats.saved)} />
            </View>
          </Panel>

          {/* Treasury balance */}
          <Pressable testID="balance-card" onPress={() => router.push("/orders")}>
            <LinearGradient
              colors={colors.brassGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.balance, { borderColor: colors.brandSecondary }]}
            >
              <View>
                <Eyebrow style={{ color: colors.onBrandPrimary, opacity: 0.7 }}>Treasury balance</Eyebrow>
                <Text style={[styles.balanceValue, { color: colors.onBrandPrimary }]}>
                  {formatPrice(profile.balance_cents)}
                </Text>
              </View>
              <MaterialCommunityIcons name="bank" size={34} color={colors.onBrandPrimary} />
            </LinearGradient>
          </Pressable>

          {/* Appearance toggle */}
          <Panel style={styles.appearance}>
            <View style={styles.appearanceRow}>
              <View style={styles.menuIconWrap}>
                <MaterialCommunityIcons name={mode === "dark" ? "weather-night" : "white-balance-sunny"} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.onSurface }]}>Lamplight mode</Text>
                <Text style={[styles.menuSub, { color: colors.muted }]}>
                  {mode === "dark" ? "Dark wood & aether glow" : "Warm parchment"}
                </Text>
              </View>
              <Switch
                testID="theme-toggle"
                value={mode === "dark"}
                onValueChange={toggle}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
          </Panel>

          {/* Menu groups */}
          {profile.menu.map((group) => (
            <View key={group.group} style={{ marginTop: spacing.lg }}>
              <Eyebrow style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>{group.group}</Eyebrow>
              <Panel padded={false}>
                {group.items.map((item, i) => (
                  <Pressable
                    key={item.to}
                    testID={`menu-${item.to}`}
                    onPress={() => handleMenu(item.to)}
                    style={({ pressed }) => [
                      styles.menuRow,
                      {
                        borderBottomColor: colors.divider,
                        borderBottomWidth: i === group.items.length - 1 ? 0 : 1,
                        backgroundColor: pressed ? colors.surfaceTertiary : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons name={item.icon as IconName} size={18} color={colors.brand} />
                    </View>
                    <Text style={[styles.menuLabel, { color: colors.onSurface, flex: 1 }]}>{item.label}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                  </Pressable>
                ))}
              </Panel>
            </View>
          ))}

          <ForgeButton
            label="Sign out of Konphlux"
            variant="outline"
            fullWidth
            style={{ marginTop: spacing.xl }}
            testID="signout-btn"
            onPress={signOut}
            icon={<MaterialCommunityIcons name="logout" size={16} color={colors.brand} />}
          />
          <Text style={[styles.version, { color: colors.muted }]}>Konphlux · Est. in the age of steam & signal</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  idCard: { overflow: "hidden" },
  rivet: { position: "absolute", width: 7, height: 7, borderRadius: 4, top: 10 },
  rivetTL: { left: 10 },
  rivetTR: { right: 10 },
  idHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: fonts.display, fontSize: 20 },
  handle: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 1 },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
  },
  titleText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  bio: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 2 },
  statValue: { fontFamily: fonts.displaySemi, fontSize: 18 },
  statLabel: { fontFamily: fonts.body, fontSize: 12 },

  balance: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceValue: { fontFamily: fonts.display, fontSize: 26, marginTop: 2 },

  appearance: { marginTop: spacing.lg },
  appearanceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },

  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  menuIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  menuSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },

  version: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.xl },
});
