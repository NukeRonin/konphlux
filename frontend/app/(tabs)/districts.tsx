import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { api, District } from "@/src/api/client";
import { AppHeader } from "@/src/components/AppHeader";
import { Eyebrow } from "@/src/components/BrassText";
import { Gear } from "@/src/components/Gear";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function DistrictCard({ district, index }: { district: District; index: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      testID={`district-${district.slug}`}
      onPress={() => router.push(`/district/${district.slug}`)}
      style={({ pressed }) => [styles.card, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient
        colors={colors.brassGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.iconPlate, { borderColor: colors.brandSecondary }]}
      >
        <Gear size={90} opacity={0.16} style={{ right: -22, bottom: -22 }} duration={30000 + index * 2000} />
        <MaterialCommunityIcons name={district.icon as IconName} size={30} color={colors.onBrandPrimary} />
      </LinearGradient>
      <View
        style={[
          styles.cardBody,
          { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        ]}
      >
        <Text numberOfLines={1} style={[styles.cardName, { color: colors.onSurface }]}>
          {district.name}
        </Text>
        <Text numberOfLines={2} style={[styles.cardTagline, { color: colors.muted }]}>
          {district.tagline}
        </Text>
        <View style={styles.cardFooter}>
          <Eyebrow>{`${district.chatmonger.name}`}</Eyebrow>
          <MaterialCommunityIcons name="arrow-right" size={15} color={colors.brand} />
        </View>
      </View>
    </Pressable>
  );
}

export default function DistrictsScreen() {
  const { colors } = useTheme();
  const [districts, setDistricts] = useState<District[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.getDistricts();
      setDistricts(res);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <AppHeader title="Districts" subtitle="Twenty quarters, One ID" />
      {status === "loading" ? (
        <Loading label="Charting the districts…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <FlatList
          data={districts}
          keyExtractor={(d) => d.slug}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <DistrictCard district={item} index={index} />}
          ListHeaderComponent={
            <Text style={[styles.intro, { color: colors.muted }]}>
              Your feed, work, marketplace, studio and classroom — riveted into one platform. Step into any quarter.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  column: { gap: spacing.md },
  card: { flex: 1, marginBottom: spacing.md },
  iconPlate: {
    height: 84,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    minHeight: 96,
  },
  cardName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  cardTagline: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, flex: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
});
