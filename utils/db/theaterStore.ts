/**
 * Theater Store — IndexedDB persistence for theater sessions and custom locations.
 * Uses the character messages store for theater dialogue (metadata.source = 'theater').
 * Uses localStorage for lightweight session state (avoids DB version bumps).
 */

import type { TheaterSessionState, TheaterLocation } from '../../types';

const THEATER_SESSION_KEY = 'theater_session_';
const THEATER_CUSTOM_LOCATIONS_KEY = 'theater_custom_locations';

// ── Session State (localStorage — lightweight, no DB migration needed) ──

export function saveTheaterSession(session: TheaterSessionState): void {
    try {
        localStorage.setItem(
            THEATER_SESSION_KEY + session.charId,
            JSON.stringify(session),
        );
    } catch (e) {
        console.error('[TheaterStore] Failed to save session:', e);
    }
}

export function getTheaterSession(charId: string): TheaterSessionState | null {
    try {
        const raw = localStorage.getItem(THEATER_SESSION_KEY + charId);
        if (!raw) return null;
        return JSON.parse(raw) as TheaterSessionState;
    } catch {
        return null;
    }
}

export function deleteTheaterSession(charId: string): void {
    try {
        localStorage.removeItem(THEATER_SESSION_KEY + charId);
    } catch { /* ignore */ }
}

// ── Custom Locations (localStorage) ──

export function getCustomLocations(): TheaterLocation[] {
    try {
        const raw = localStorage.getItem(THEATER_CUSTOM_LOCATIONS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as TheaterLocation[];
    } catch {
        return [];
    }
}

export function saveCustomLocations(locations: TheaterLocation[]): void {
    try {
        localStorage.setItem(THEATER_CUSTOM_LOCATIONS_KEY, JSON.stringify(locations));
    } catch (e) {
        console.error('[TheaterStore] Failed to save custom locations:', e);
    }
}

export function addCustomLocation(location: TheaterLocation): void {
    const existing = getCustomLocations();
    existing.push(location);
    saveCustomLocations(existing);
}

export function deleteCustomLocation(id: string): void {
    const existing = getCustomLocations().filter(l => l.id !== id);
    saveCustomLocations(existing);
}

export function updateCustomLocation(id: string, updates: Partial<TheaterLocation>): void {
    const existing = getCustomLocations().map(l =>
        l.id === id ? { ...l, ...updates } : l
    );
    saveCustomLocations(existing);
}

// ── Visit Counts (persistent across sessions) ──

const THEATER_VISIT_COUNTS_KEY = 'theater_visit_counts';

export function getVisitCounts(): Record<string, number> {
    try {
        const raw = localStorage.getItem(THEATER_VISIT_COUNTS_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, number>;
    } catch {
        return {};
    }
}

export function incrementVisitCount(locationId: string): number {
    const counts = getVisitCounts();
    const next = (counts[locationId] || 0) + 1;
    counts[locationId] = next;
    try {
        localStorage.setItem(THEATER_VISIT_COUNTS_KEY, JSON.stringify(counts));
    } catch { /* ignore */ }
    return next;
}
