import * as StoreReview from "expo-store-review";

import { storage } from "@/src/utils/storage";

const OPENS_KEY = "konphlux.rate.opens";
const ASKED_KEY = "konphlux.rate.asked";
const THRESHOLD = 3; // ask after the 3rd meaningful visit

/**
 * Best-effort in-app review prompt. Counts Feed visits and, once the user has
 * returned a few times, asks the OS to show the native "Rate this app" sheet
 * (only shown on real device builds — a no-op in Expo Go / web).
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    if ((await storage.getItem<string>(ASKED_KEY, "")) === "1") return;

    const opens = (parseInt((await storage.getItem<string>(OPENS_KEY, "0")) || "0", 10) || 0) + 1;
    await storage.setItem(OPENS_KEY, String(opens));
    if (opens < THRESHOLD) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    await StoreReview.requestReview();
    await storage.setItem(ASKED_KEY, "1");
  } catch {
    /* never disrupt the app for a review prompt */
  }
}
