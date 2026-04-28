const FULLSCREEN_ENABLED_KEY = 'os_fullscreen_enabled';

/**
 * Checks whether the user enabled immersive fullscreen mode.
 */
export function isFullscreenEnabled(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Requests browser fullscreen when the user enabled the preference.
 */
export function requestSystemFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (!isFullscreenEnabled()) return;

  const el = document.documentElement;
  const request =
    el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).mozRequestFullScreen ||
    (el as any).msRequestFullscreen;

  if (request && !document.fullscreenElement) {
    request.call(el).catch(() => {
      // Some browsers reject when fullscreen is unsupported or not gesture-initiated.
    });
  }
}

/**
 * Exits browser fullscreen.
 */
export function exitSystemFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}
