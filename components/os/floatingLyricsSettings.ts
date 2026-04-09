export type LyricPosition = 'top' | 'center' | 'bottom';

export interface FloatingLyricsSettings {
    enabled: boolean;
    position: LyricPosition;
    showTranslation: boolean;
    opacity: number;
}

export const LYRIC_SETTINGS_KEY = 'floating_lyrics_settings';

export const DEFAULT_FLOATING_LYRICS_SETTINGS: FloatingLyricsSettings = {
    enabled: false,
    position: 'bottom',
    showTranslation: true,
    opacity: 0.85,
};

function isLyricPosition(value: unknown): value is LyricPosition {
    return value === 'top' || value === 'center' || value === 'bottom';
}

function clampOpacity(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return DEFAULT_FLOATING_LYRICS_SETTINGS.opacity;
    }

    return Math.max(0, Math.min(1, value));
}

export function readFloatingLyricsSettings(): FloatingLyricsSettings {
    try {
        const raw = localStorage.getItem(LYRIC_SETTINGS_KEY);
        if (!raw) {
            return { ...DEFAULT_FLOATING_LYRICS_SETTINGS };
        }

        const parsed = JSON.parse(raw) as Partial<FloatingLyricsSettings>;

        return {
            enabled:
                typeof parsed.enabled === 'boolean'
                    ? parsed.enabled
                    : DEFAULT_FLOATING_LYRICS_SETTINGS.enabled,
            position: isLyricPosition(parsed.position)
                ? parsed.position
                : DEFAULT_FLOATING_LYRICS_SETTINGS.position,
            showTranslation:
                typeof parsed.showTranslation === 'boolean'
                    ? parsed.showTranslation
                    : DEFAULT_FLOATING_LYRICS_SETTINGS.showTranslation,
            opacity: clampOpacity(parsed.opacity),
        };
    } catch {
        return { ...DEFAULT_FLOATING_LYRICS_SETTINGS };
    }
}

function notifyFloatingLyricsSettingsChanged(): void {
    window.dispatchEvent(new Event('storage'));
}

export function writeFloatingLyricsSettings(
    settings: FloatingLyricsSettings,
): FloatingLyricsSettings {
    try {
        localStorage.setItem(LYRIC_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage failures.
    }

    notifyFloatingLyricsSettingsChanged();
    return settings;
}

export function updateFloatingLyricsSettings(
    patch: Partial<FloatingLyricsSettings>,
): FloatingLyricsSettings {
    const current = readFloatingLyricsSettings();
    const next: FloatingLyricsSettings = {
        enabled:
            typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
        position: isLyricPosition(patch.position)
            ? patch.position
            : current.position,
        showTranslation:
            typeof patch.showTranslation === 'boolean'
                ? patch.showTranslation
                : current.showTranslation,
        opacity:
            patch.opacity === undefined ? current.opacity : clampOpacity(patch.opacity),
    };

    return writeFloatingLyricsSettings(next);
}

export function toggleFloatingLyricsEnabled(): FloatingLyricsSettings {
    const current = readFloatingLyricsSettings();
    return writeFloatingLyricsSettings({
        ...current,
        enabled: !current.enabled,
    });
}
