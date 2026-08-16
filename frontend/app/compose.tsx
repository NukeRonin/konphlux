import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ComposeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await api.createPost(text.trim());
      router.back();
    } catch {
      setPosting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="compose-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>New Dispatch</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authorRow}>
          <AvatarInitials name="Wilhelmina Grast" size={44} />
          <View>
            <Text style={[styles.author, { color: colors.onSurface }]}>Wilhelmina Grast</Text>
            <Eyebrow>Posting to your feed</Eyebrow>
          </View>
        </View>
        <TextInput
          testID="compose-input"
          value={text}
          onChangeText={setText}
          placeholder="What are you building today, Artificer?"
          placeholderTextColor={colors.muted}
          multiline
          autoFocus
          style={[styles.input, { color: colors.onSurface }]}
        />
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom > 0 ? 0 : spacing.md }}>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.surfaceSecondary,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <Text style={[styles.count, { color: colors.muted }]}>{text.length}/500</Text>
          <ForgeButton
            label="Post to the wire"
            onPress={submit}
            loading={posting}
            disabled={!text.trim()}
            testID="compose-submit"
            icon={<MaterialCommunityIcons name="send" size={16} color={colors.onBrandPrimary} />}
          />
        </View>
      </KeyboardStickyView>
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
  body: { padding: spacing.lg, gap: spacing.lg },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  author: { fontFamily: fonts.displaySemi, fontSize: 15 },
  input: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 160,
    textAlignVertical: "top",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  count: { fontFamily: fonts.body, fontSize: 13 },
});
