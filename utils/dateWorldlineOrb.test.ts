import { describe, expect, it } from 'vitest';
import {
    DATE_WORLDLINE_COMPLETED_KEY,
    DATE_WORLDLINE_READY_CHAR_KEY,
    clearReadyWorldlineCharId,
    get520CountdownText,
    getReadyWorldlineCharId,
    isDateWorldlineCompleted,
    markDateWorldlineCompleted,
    readStorageFlag,
    setReadyWorldlineCharId,
    writeStorageFlag,
    type StorageLike,
} from './dateWorldlineOrb';

function createStorage(entries: Record<string, string> = {}): StorageLike {
    return {
        getItem(key: string) {
            return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
        },
        setItem(key: string, value: string) {
            entries[key] = value;
        },
        removeItem(key: string) {
            delete entries[key];
        },
    };
}

describe('dateWorldlineOrb', () => {
    it('uses the requested 520 countdown copy on May 18/19/20', () => {
        expect(get520CountdownText(new Date(2026, 4, 18))).toBe('还有 2 天就是 520 了');
        expect(get520CountdownText(new Date(2026, 4, 19))).toBe('明天就是 520 了');
        expect(get520CountdownText(new Date(2026, 4, 20))).toBe('今天就是 520 了');
    });

    it('stores the one-time completed flag locally', () => {
        const storage = createStorage();

        expect(isDateWorldlineCompleted(storage)).toBe(false);
        markDateWorldlineCompleted(storage);

        expect(isDateWorldlineCompleted(storage)).toBe(true);
        expect(readStorageFlag(DATE_WORLDLINE_COMPLETED_KEY, storage)).toBe(true);
    });

    it('stores the ready character in session-like storage', () => {
        const storage = createStorage();

        expect(getReadyWorldlineCharId(storage)).toBeNull();
        setReadyWorldlineCharId('char-520', storage);
        expect(getReadyWorldlineCharId(storage)).toBe('char-520');

        clearReadyWorldlineCharId(storage);
        expect(getReadyWorldlineCharId(storage)).toBeNull();
        expect(readStorageFlag(DATE_WORLDLINE_READY_CHAR_KEY, storage)).toBe(false);
    });

    it('ignores missing storage safely', () => {
        expect(readStorageFlag('missing', null)).toBe(false);
        expect(() => writeStorageFlag('missing', null)).not.toThrow();
    });
});
