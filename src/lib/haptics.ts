/**
 * Cross-platform haptic feedback utility
 * Uses navigator.vibrate for web, can be upgraded to @capacitor/haptics for native
 */

/**
 * Check if vibration API is available
 */
function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Light vibration for subtle feedback (mode selection, item added to batch)
 */
export function hapticLight(): void {
  if (canVibrate()) {
    navigator.vibrate(10);
  }
}

/**
 * Medium impact for successful actions (scan detected, item/location found)
 */
export function hapticMedium(): void {
  if (canVibrate()) {
    navigator.vibrate(25);
  }
}

/**
 * Strong impact for confirmations (swipe complete)
 */
export function hapticHeavy(): void {
  if (canVibrate()) {
    navigator.vibrate(50);
  }
}

/**
 * Success pattern - double tap for confirmed actions
 */
export function hapticSuccess(): void {
  if (canVibrate()) {
    navigator.vibrate([30, 50, 30]);
  }
}

/**
 * Error pattern - longer vibration for failures
 */
export function hapticError(): void {
  if (canVibrate()) {
    navigator.vibrate([100, 50, 100]);
  }
}

/**
 * Selection tick - very subtle feedback for selections
 */
export function hapticSelection(): void {
  if (canVibrate()) {
    navigator.vibrate(5);
  }
}
