import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function About() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const version = Constants.expoConfig?.version ?? "1.0.0";

  const Row = ({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) => (
    <Pressable onPress={onPress} testID={testID} style={styles.row}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.brand} />
      <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );

  const CREDITS = [
    { role: "Districts", value: "Twenty quarters — social, learning, creation, commerce & more" },
    { role: "Design", value: "Steampunk parchment aesthetic · Cinzel & Karla" },
    { role: "Built with", value: "Expo · React Native · FastAPI · MongoDB" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="about-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>About</Text>
          <Eyebrow>The story of Konphlux</Eyebrow>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={require("../assets/images/logo-mark.png")} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.appName, { color: colors.onSurface }]}>KONPHLUX</Text>
          <Text style={[styles.tagline, { color: colors.brand }]}>Twenty quarters, One ID</Text>
          <View style={[styles.versionPill, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="tag-outline" size={13} color={colors.muted} />
            <Text style={[styles.versionText, { color: colors.muted }]}>Version {version}</Text>
          </View>
        </View>

        <Text style={[styles.blurb, { color: colors.muted }]}>
          Konphlux is an entire steampunk ecosystem in one app — connect with friends, create with AI, learn, watch,
          shop, work and build, all under a single identity. Est. in the age of steam &amp; signal.
        </Text>

        <Eyebrow style={styles.groupLabel}>Credits</Eyebrow>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {CREDITS.map((c, i) => (
            <View key={c.role} style={[styles.creditRow, i > 0 && { borderTopColor: colors.divider, borderTopWidth: 1 }]}>
              <Text style={[styles.creditRole, { color: colors.brand }]}>{c.role}</Text>
              <Text style={[styles.creditValue, { color: colors.onSurface }]}>{c.value}</Text>
            </View>
          ))}
        </View>

        <Eyebrow style={styles.groupLabel}>Legal</Eyebrow>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row icon="shield-lock-outline" label="Privacy Policy" onPress={() => router.push("/privacy")} testID="about-privacy" />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 52 }} />
          <Row icon="file-document-outline" label="Terms of Service" onPress={() => router.push("/terms")} testID="about-terms" />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 52 }} />
          <Row icon="email-edit-outline" label="Contact Us" onPress={() => router.push("/contact")} testID="about-contact" />
        </View>

        <Text style={[styles.copyright, { color: colors.muted }]}>© 2026 Konphlux. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  hero: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  logo: { width: 104, height: 104, borderRadius: 22 },
  appName: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 3, marginTop: spacing.sm },
  tagline: { fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 0.5 },
  versionPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 30, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.sm },
  versionText: { fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  blurb: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, textAlign: "center", marginBottom: spacing.md },
  groupLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  creditRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  creditRole: { fontFamily: fonts.bodyBold, fontSize: 12.5, letterSpacing: 0.4, textTransform: "uppercase" },
  creditValue: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, height: 52 },
  rowLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
  copyright: { fontFamily: fonts.body, fontSize: 12.5, textAlign: "center", marginTop: spacing.xxl },
});
