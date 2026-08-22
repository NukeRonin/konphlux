import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";

import { useTheme } from "@/src/theme/ThemeContext";

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons
          key={n}
          name={rating >= n ? "star" : rating >= n - 0.5 ? "star-half-full" : "star-outline"}
          size={size}
          color={rating >= n - 0.5 ? "#D69E2E" : colors.muted}
        />
      ))}
    </View>
  );
}
