export type HapticKind = "light" | "medium" | "success";

// Durations/patterns in milliseconds, not motor strength.
const patterns: Record<HapticKind, number | number[]> = {
  light: 20,
  medium: 50,
  success: [25, 35, 45],
};

export function triggerHaptic(kind: HapticKind): void {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  )
    return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible")
    return;
  try {
    navigator.vibrate(patterns[kind]);
  } catch {
    // Optional feedback must never interrupt a workout, even if the API rejects it.
  }
}
