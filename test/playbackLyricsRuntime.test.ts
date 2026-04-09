import { beforeEach,describe,expect,it,vi } from 'vitest';

vi.mock('../utils/musicService', () => ({
    getLyric: vi.fn(),
}));

import { getLyric } from '../utils/musicService';
import {
    buildPlaybackLyricSnapshot,
    getDistinctLyricTranslation,
    getPlaybackLyricKey,
    getPlaybackLyricSnapshot,
    getPlaybackLyricsResource,
    resetPlaybackLyricsRuntimeForTests,
    shouldInjectPlaybackLyricSnapshot,
} from '../utils/playbackLyricsRuntime';

const mockedGetLyric = vi.mocked(getLyric);

describe('playbackLyricsRuntime', () => {
    beforeEach(() => {
        resetPlaybackLyricsRuntimeForTests();
        mockedGetLyric.mockReset();
    });

    it('caches lyric fetches per song id', async () => {
        mockedGetLyric.mockResolvedValue({
            lrc: { lyric: '[00:01.00]第一句\n[00:05.00]第二句' },
            tlyric: { lyric: '[00:01.00]First line' },
        });

        const [resourceA, resourceB] = await Promise.all([
            getPlaybackLyricsResource(42),
            getPlaybackLyricsResource(42),
        ]);

        expect(mockedGetLyric).toHaveBeenCalledTimes(1);
        expect(resourceA.lines).toHaveLength(2);
        expect(resourceB.lines[0].text).toBe('第一句');
    });

    it('builds a snapshot for the active lyric line', () => {
        const snapshot = buildPlaybackLyricSnapshot(1, 5.5, [
            { time: 4, text: '你先开了口', translation: 'You spoke first' },
            { time: 8, text: '我还没点头' },
        ]);

        expect(snapshot).toBeTruthy();
        expect(snapshot?.currentIndex).toBe(0);
        expect(snapshot?.currentText).toBe('你先开了口');
        expect(snapshot?.currentTranslation).toBe('You spoke first');
        expect(snapshot?.lineStartTime).toBe(4);
        expect(snapshot?.nextLineTime).toBe(8);
    });

    it('allows stable, non-duplicate lyric snapshots to be injected', () => {
        const snapshot = {
            songId: 1,
            currentIndex: 0,
            currentText: '你先开了口',
            currentTranslation: '',
            currentTime: 5.2,
            lineStartTime: 4,
            nextLineTime: 8,
            updatedAt: 1000,
        };

        expect(shouldInjectPlaybackLyricSnapshot(snapshot, null)).toBe(true);
    });

    it('blocks unstable, duplicate, noisy, and stale last-line snapshots', () => {
        const unstableSnapshot = {
            songId: 1,
            currentIndex: 0,
            currentText: '你先开了口',
            currentTranslation: '',
            currentTime: 4.3,
            lineStartTime: 4,
            nextLineTime: 8,
            updatedAt: 1000,
        };
        expect(shouldInjectPlaybackLyricSnapshot(unstableSnapshot, null)).toBe(false);

        const stableSnapshot = {
            ...unstableSnapshot,
            currentTime: 5.2,
        };
        expect(
            shouldInjectPlaybackLyricSnapshot(
                stableSnapshot,
                getPlaybackLyricKey(stableSnapshot),
            ),
        ).toBe(false);

        const noisySnapshot = {
            ...stableSnapshot,
            currentText: '啦啦啦',
        };
        expect(shouldInjectPlaybackLyricSnapshot(noisySnapshot, null)).toBe(false);

        const staleLastLine = {
            ...stableSnapshot,
            currentText: '终于来到这里',
            currentTime: 16.2,
            lineStartTime: 10,
            nextLineTime: null,
        };
        expect(shouldInjectPlaybackLyricSnapshot(staleLastLine, null)).toBe(false);
    });

    it('returns null when playback has not reached the first lyric line', async () => {
        mockedGetLyric.mockResolvedValue({
            lrc: { lyric: '[00:10.00]晚一点才开口' },
        });

        const snapshot = await getPlaybackLyricSnapshot(7, 2);

        expect(snapshot).toBeNull();
    });

    it('drops translation lines that duplicate the original lyric', () => {
        expect(getDistinctLyricTranslation('Hello', 'Hello')).toBe('');
        expect(getDistinctLyricTranslation('你好', '')).toBe('');
        expect(getDistinctLyricTranslation('你好', 'Hello')).toBe('Hello');
    });
});
