import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, BBQuizCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function Quizzes() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [quizzes, setQuizzes] = useState<BBQuizCard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setQuizzes(await api.bbQuizzes());
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="quizzes-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Quizzes</Text>
          <Eyebrow>Test what you know</Eyebrow>
        </View>
      </View>

      <FlatList
        data={quizzes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable testID={`quiz-${item.id}`} onPress={() => router.push(`/brainboost/quiz/${item.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name={item.icon as IconName} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.category} · {item.question_count} questions</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Sharpening pencils…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="help-circle" title="No quizzes yet" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  icon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemi, fontSize: 16 },
  meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
