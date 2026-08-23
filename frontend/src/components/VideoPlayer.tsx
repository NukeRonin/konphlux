import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { radius } from "@/src/theme/tokens";

export function VideoPlayer({ uri, style, onProgress, syncPosition, loop }: { uri: string; style?: any; onProgress?: (position: number, duration: number) => void; syncPosition?: number; loop?: boolean }) {
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = !!loop;
  });
  const cbRef = useRef(onProgress);
  cbRef.current = onProgress;

  // Report playback position periodically and on unmount so "Continue Watching" works.
  useEffect(() => {
    if (!onProgress) return;
    const report = () => {
      try {
        const pos = player.currentTime ?? 0;
        const dur = player.duration ?? 0;
        if (dur > 0) cbRef.current?.(pos, dur);
      } catch { /* ignore */ }
    };
    const t = setInterval(report, 5000);
    return () => { report(); clearInterval(t); };
  }, [player, onProgress]);

  // Watch Party guests: seek to the host's position when it drifts too far.
  useEffect(() => {
    if (syncPosition == null) return;
    try {
      if (Math.abs((player.currentTime ?? 0) - syncPosition) > 3) player.currentTime = syncPosition;
    } catch { /* ignore */ }
  }, [player, syncPosition]);

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
