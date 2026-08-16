import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { Chatmonger } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, spacing } from "@/src/theme/tokens";

/** The "Meet <name>" chatmonger character card with aether glow. */
export function ChatmongerCard({ chatmonger, district }: { chatmonger: Chatmonger; district: string }) {
  const { colors } = useTheme();
  return (
    <Panel glow testID="chatmonger-card">
      <View style={styles.head}>
        <AvatarInitials name={chatmonger.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.onSurface }]}>Meet {chatmonger.name}</Text>
          <Eyebrow>{`${chatmonger.role} · Chatmonger of ${district}`}</Eyebrow>
        </View>
        <MaterialCommunityIcons name="chat-question" size={22} color={colors.aether} />
      </View>
      <Text style={[styles.greeting, { color: colors.onSurface }]}>
        “{chatmonger.greeting}”
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: 3 },
  greeting: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md, fontStyle: "italic" },
});
