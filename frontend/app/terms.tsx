import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Acceptance of Terms",
    body: [
      "By creating an account or using Konphlux (the \u201cService\u201d), you agree to these Terms of Service. If you do not agree, please do not use the Service.",
    ],
  },
  {
    heading: "2. Eligibility & Accounts",
    body: [
      "You must be at least 13 years old (or the minimum age required in your country) to use Konphlux.",
      "You are responsible for keeping your login credentials secure and for all activity under your account.",
      "You must provide accurate information and keep it up to date.",
    ],
  },
  {
    heading: "3. Your Content",
    body: [
      "You retain ownership of the content you create and post (posts, articles, listings, media, reviews).",
      "By posting, you grant Konphlux a non-exclusive licence to host, display and distribute your content within the Service so features work.",
      "You are responsible for the content you post and must have the rights to share it.",
    ],
  },
  {
    heading: "4. Acceptable Use",
    body: [
      "Do not post unlawful, hateful, harassing, deceptive, infringing or explicit content.",
      "Do not spam, scam, impersonate others, or attempt to disrupt or reverse-engineer the Service.",
      "We may remove content or suspend accounts that violate these terms.",
    ],
  },
  {
    heading: "5. AI-Generated Content",
    body: [
      "Some tools generate text, images or video using AI. You are responsible for how you use AI outputs and for ensuring they do not infringe others\u2019 rights.",
    ],
  },
  {
    heading: "6. Purchases, Wallet & Bookings",
    body: [
      "Payments are processed by third parties (e.g. Stripe). Prices are shown before purchase.",
      "The in-app Treasury wallet is for use within Konphlux. Bookings and marketplace deals are agreements between users; Konphlux is not a party to them unless stated.",
      "Refund eligibility depends on the seller/host and applicable law.",
    ],
  },
  {
    heading: "7. Termination & Account Deletion",
    body: [
      "You may delete your account at any time from Settings \u2192 Account \u2192 Delete account. Deletion is permanent and removes your account and associated data.",
      "We may suspend or terminate accounts that breach these terms.",
    ],
  },
  {
    heading: "8. Disclaimers",
    body: [
      "The Service is provided \u201cas is\u201d without warranties of any kind. We do not guarantee it will be uninterrupted or error-free.",
    ],
  },
  {
    heading: "9. Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, Konphlux is not liable for indirect, incidental or consequential damages arising from your use of the Service.",
    ],
  },
  {
    heading: "10. Changes to These Terms",
    body: [
      "We may update these terms from time to time. Continued use after changes means you accept the updated terms.",
    ],
  },
];

export default function TermsOfService() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="terms-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Terms of Service</Text>
          <Eyebrow>The rules of the realm</Eyebrow>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.effective, { color: colors.muted }]}>Effective date: 1 June 2026</Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={{ marginTop: spacing.lg }}>
            <Text style={[styles.heading, { color: colors.onSurface }]}>{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={[styles.para, { color: colors.muted }]}>{p}</Text>
            ))}
          </View>
        ))}

        <View style={{ marginTop: spacing.xl }}>
          <Text style={[styles.heading, { color: colors.onSurface }]}>11. Contact</Text>
          <Text style={[styles.para, { color: colors.muted }]}>Questions about these terms? Reach us at:</Text>
          <Pressable onPress={() => Linking.openURL("mailto:konphluxoverlord@gmail.com?subject=Terms%20Question")} testID="terms-email">
            <Text style={[styles.link, { color: colors.brand }]}>konphluxoverlord@gmail.com</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  effective: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 16, marginBottom: spacing.sm },
  para: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, marginBottom: spacing.sm },
  link: { fontFamily: fonts.bodyBold, fontSize: 14.5, marginTop: spacing.xs },
});
