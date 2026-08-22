// In-memory unlock state for the Treasury district gate.
// Never persisted — cleared on reload/logout. Short TTL so re-opening the
// district after stepping away re-prompts, while brief in-district navigation
// (balance -> trackers) doesn't nag the user.
const TTL_MS = 90 * 1000;
let unlockedAt = 0;

export function markTreasuryUnlocked() {
  unlockedAt = Date.now();
}

export function isTreasuryUnlocked(): boolean {
  return unlockedAt > 0 && Date.now() - unlockedAt < TTL_MS;
}

export function lockTreasury() {
  unlockedAt = 0;
}
