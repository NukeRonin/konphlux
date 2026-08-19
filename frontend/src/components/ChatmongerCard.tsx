import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { Chatmonger } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

/** The "Meet <name>" chatmonger character card with aether glow. Tappable to open AI chat. */
export function ChatmongerCard({
  chatmonger,
  district,
  onPress,
}: {
  chatmonger: Chatmonger;
  district: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} testID="chatmonger-card">
      <Panel glow>
        <View style={styles.head}>
          <AvatarInitials name={chatmonger.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.onSurface }]}>Meet {chatmonger.name}</Text>
            <Eyebrow>{`${chatmonger.role} · Chatmonger of ${district}`}</Eyebrow>
          </View>
          <MaterialCommunityIcons name="chat-question" size={22} color={colors.aether} />
        </View>
        <Text style={[styles.greeting, { color: colors.onSurface }]}>“{chatmonger.greeting}”</Text>
        {onPress ? (
          <View style={[styles.cta, { backgroundColor: colors.aether }]}>
            <MaterialCommunityIcons name="message-text" size={16} color={colors.onAether} />
            <Text style={[styles.ctaText, { color: colors.onAether }]}>Chat with {chatmonger.name}</Text>
          </View>
        ) : null}
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: 3 },
  greeting: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md, fontStyle: "italic" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.lg,
    height: 44,
    borderRadius: radius.md,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
