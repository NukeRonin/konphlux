import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { StyleSheet, View } from "react-native";

import { radius } from "@/src/theme/tokens";

export function VideoPlayer({ uri, style }: { uri: string; style?: any }) {
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
  });

  return (
    <View style={[styles.wrap, style]}>
      <VideoView style={styles.video} player={player} allowsFullscreen contentFit="contain" nativeControls />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" },
  video: { flex: 1 },
});
