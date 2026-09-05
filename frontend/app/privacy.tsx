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
    heading: "1. Overview",
    body: [
      "Konphlux (\u201cwe\u201d, \u201cour\u201d, \u201cus\u201d) is an all-in-one social and utility platform. This policy explains what information we collect, how we use it, and the choices you have. By using Konphlux you agree to this policy.",
    ],
  },
  {
    heading: "2. Information We Collect",
    body: [
      "Account details: your email address and display name when you register.",
      "Content you create: posts, messages, articles, listings, reviews, images and other media you upload.",
      "Usage data: actions you take in the app (likes, saves, friends, purchases) to make features work.",
      "Approximate location: only if you grant permission, used to show nearby businesses and stays.",
      "Payment information: processed securely by Stripe. We do not store your full card details on our servers.",
    ],
  },
  {
    heading: "3. How We Use Your Information",
    body: [
      "To provide and operate the app\u2019s features across all districts.",
      "To personalize your feed, recommendations and notifications.",
      "To enable social features such as friends, messaging and profiles.",
      "To process orders, bookings and wallet transactions.",
      "To keep the platform safe, prevent abuse and comply with the law.",
    ],
  },
  {
    heading: "4. AI Features",
    body: [
      "Some features (art, video, writing and chat assistants) send your prompts to third-party AI providers to generate results. Do not include sensitive personal information in prompts.",
    ],
  },
  {
    heading: "5. Sharing",
    body: [
      "We do not sell your personal information. We share data only with service providers who help us run the app (e.g. hosting, payments, AI, email), and when required by law.",
      "Content you post publicly (profiles, articles, listings) is visible to other users.",
    ],
  },
  {
    heading: "6. Data Retention & Security",
    body: [
      "We keep your information for as long as your account is active. Data is encrypted in transit. No method of transmission is 100% secure, but we take reasonable measures to protect your data.",
    ],
  },
  {
    heading: "7. Your Choices & Rights",
    body: [
      "You can edit your profile, control location permission in your device settings, and request account or data deletion at any time by contacting us.",
      "Delete your account in-app anytime: Settings \u2192 Account \u2192 Delete account. You can also request deletion from our web page at /api/web/delete-account on our server.",
    ],
  },
  {
    heading: "8. Children",
    body: [
      "Konphlux is not intended for children under 13 (or the minimum age required in your country). We do not knowingly collect data from children.",
    ],
  },
  {
    heading: "9. Changes",
    body: [
      "We may update this policy from time to time. Material changes will be reflected here with a new effective date.",
    ],
  },
];

export default function PrivacyPolicy() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="privacy-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Privacy Policy</Text>
          <Eyebrow>How we handle your data</Eyebrow>
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
          <Text style={[styles.heading, { color: colors.onSurface }]}>10. Contact Us</Text>
          <Text style={[styles.para, { color: colors.muted }]}>
            Questions or requests about your privacy? Reach us anytime:
          </Text>
          <Pressable onPress={() => Linking.openURL("mailto:konphluxoverlord@gmail.com?subject=Privacy%20Request")} testID="privacy-email">
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
