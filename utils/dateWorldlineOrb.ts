export const DATE_WORLDLINE_EVENT_ID = 'sullyos_520_date_worldline_2026';
export const DATE_WORLDLINE_COMPLETED_KEY = `${DATE_WORLDLINE_EVENT_ID}_completed`;
export const DATE_WORLDLINE_READY_CHAR_KEY = `${DATE_WORLDLINE_EVENT_ID}_ready_char`;
export const DATE_WORLDLINE_THEATER_GUIDE_KEY = `${DATE_WORLDLINE_EVENT_ID}_date_guide_seen`;
export const DATE_WORLDLINE_LOCATION_GUIDE_KEY = `${DATE_WORLDLINE_EVENT_ID}_location_guide_seen`;

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function getLocalStorage(): StorageLike | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

function getSessionStorage(): StorageLike | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        return null;
    }
}

export function readStorageFlag(key: string, storage: StorageLike | null = getLocalStorage()): boolean {
    if (!storage) return false;
    try {
        return Boolean(storage.getItem(key));
    } catch {
        return false;
    }
}

export function writeStorageFlag(key: string, storage: StorageLike | null = getLocalStorage()): void {
    if (!storage) return;
    try {
        storage.setItem(key, String(Date.now()));
    } catch {
        // Ignore storage failures; the guide can safely reappear.
    }
}

export function isDateWorldlineCompleted(storage: StorageLike | null = getLocalStorage()): boolean {
    return readStorageFlag(DATE_WORLDLINE_COMPLETED_KEY, storage);
}

export function markDateWorldlineCompleted(storage: StorageLike | null = getLocalStorage()): void {
    writeStorageFlag(DATE_WORLDLINE_COMPLETED_KEY, storage);
}

export function getReadyWorldlineCharId(storage: StorageLike | null = getSessionStorage()): string | null {
    if (!storage) return null;
    try {
        return storage.getItem(DATE_WORLDLINE_READY_CHAR_KEY);
    } catch {
        return null;
    }
}

export function setReadyWorldlineCharId(charId: string, storage: StorageLike | null = getSessionStorage()): void {
    if (!storage) return;
    try {
        storage.setItem(DATE_WORLDLINE_READY_CHAR_KEY, charId);
    } catch {
        // Ignore storage failures; current component state still carries the flow.
    }
}

export function clearReadyWorldlineCharId(storage: StorageLike | null = getSessionStorage()): void {
    if (!storage) return;
    try {
        storage.removeItem(DATE_WORLDLINE_READY_CHAR_KEY);
    } catch {
        // Ignore storage failures.
    }
}

export function get520CountdownText(now: Date = new Date()): string {
    const month = now.getMonth();
    const day = now.getDate();

    if (month === 4 && day === 18) return '还有 2 天就是 520 了';
    if (month === 4 && day === 19) return '明天就是 520 了';
    if (month === 4 && day === 20) return '今天就是 520 了';

    const target = new Date(now.getFullYear(), 4, 20);
    const today = new Date(now.getFullYear(), month, day);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);

    if (diffDays > 1) return `还有 ${diffDays} 天就是 520 了`;
    if (diffDays === 1) return '明天就是 520 了';
    if (diffDays === 0) return '今天就是 520 了';
    return '这个五月，还有一场约会没出发';
}
