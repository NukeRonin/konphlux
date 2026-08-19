import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const ICONS: IconName[] = ["forum", "anvil", "lightning-bolt", "chart-line", "book-open-variant", "coffee", "gamepad-variant", "palette", "music", "leaf"];

export default function NewCommunity() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState<IconName>("forum");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (name.trim().length < 2 || !desc.trim()) {
      setError("Give it a name (2+ chars) and a short description.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const c = await api.rtCreateCommunity(name.trim(), desc.trim(), icon);
      router.replace(`/roundtable/community/${c.id}`);
    } catch {
      setError("Couldn't create the community. Try again.");
      setBusy(false);
    }
  };


  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="nc-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Found a Community</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Eyebrow>Emblem</Eyebrow>
        <View style={styles.iconGrid}>
          {ICONS.map((ic) => (
            <Pressable
              key={ic}
              testID={`nc-icon-${ic}`}
              onPress={() => setIcon(ic)}
              style={[styles.iconChip, { backgroundColor: icon === ic ? colors.brand : colors.surfaceSecondary, borderColor: icon === ic ? colors.brand : colors.border }]}
            >
              <MaterialCommunityIcons name={ic} size={22} color={icon === ic ? colors.onBrandPrimary : colors.brand} />
            </Pressable>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>Name</Eyebrow>
        <TextInput
          testID="nc-name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Gearheads Anonymous"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          maxLength={60}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Description</Eyebrow>
        <TextInput
          testID="nc-desc"
          value={desc}
          onChangeText={setDesc}
          placeholder="What is this community about?"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          maxLength={280}
        />

        {error ? <Text testID="nc-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Found community" fullWidth size="lg" loading={busy} onPress={submit} testID="nc-submit" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  body: { padding: spacing.lg, gap: spacing.sm },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  iconChip: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
