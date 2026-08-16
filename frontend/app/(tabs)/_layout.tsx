import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({
  focused,
  name,
  label,
  color,
}: {
  focused: boolean;
  name: IconName;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.tabItem}>
      <MaterialCommunityIcons name={name} size={focused ? 25 : 23} color={color} />
      <Text numberOfLines={1} style={[styles.tabLabel, { color, fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium }]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          ...Platform.select({ android: { elevation: 12 }, default: {} }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? "home" : "home-outline"} label="Feed" />
          ),
        }}
      />
      <Tabs.Screen
        name="districts"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? "compass" : "compass-outline"} label="Districts" />
          ),
        }}
      />
      <Tabs.Screen
        name="bazaar"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? "storefront" : "storefront-outline"} label="Bazaar" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} name={focused ? "account-circle" : "account-circle-outline"} label="HQ" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: "center", justifyContent: "center", width: 68, gap: 2 },
  tabLabel: { fontSize: 10.5, letterSpacing: 0.3 },
});
