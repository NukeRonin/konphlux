import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

/**
 * Download a remote media file to a local cache path and open the native
 * share sheet so the user can save it to their device or send it on.
 * Falls back to sharing the raw URL when file access/sharing is unavailable.
 */
export async function downloadAndShare(url: string, filename: string): Promise<void> {
  if (!url) return;
  if (Platform.OS === "web") {
    try { await Share.share({ url, message: url }); } catch { /* ignore */ }
    return;
  }
  try {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const target = (FileSystem.cacheDirectory ?? "") + safe;
    const { uri } = await FileSystem.downloadAsync(url, target);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      await Share.share({ url: uri, message: url });
    }
  } catch {
    try { await Share.share({ url, message: url }); } catch { /* ignore */ }
  }
}

/** Share an already-local file URI (e.g. a watermarked capture). */
export async function shareLocalUri(uri: string): Promise<void> {
  if (!uri) return;
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    else await Share.share({ url: uri });
  } catch {
    try { await Share.share({ url: uri }); } catch { /* ignore */ }
  }
}
