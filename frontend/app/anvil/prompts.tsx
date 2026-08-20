import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function Prompts() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prompts, setPrompts] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.anvilPrompts();
      setPrompts(res.prompts);
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

  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <Pressable
      testID={`prompt-${index}`}
      onPress={() => router.push({ pathname: "/anvil/write", params: { prompt: item } })}
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.brandSecondary} />
      <Text style={[styles.text, { color: colors.onSurface }]}>{item}</Text>
      <View style={[styles.cta, { borderColor: colors.brand }]}>
        <MaterialCommunityIcons name="feather" size={13} color={colors.brand} />
        <Text style={[styles.ctaText, { color: colors.brand }]}>Write from this</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="prompts-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Writing Prompts</Text>
          <Eyebrow>A spark to start</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Fetching prompts…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={prompts}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  text: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 22 },
  cta: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
