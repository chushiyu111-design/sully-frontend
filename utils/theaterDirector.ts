/**
 * Theater Director Engine — 导演引擎核心逻辑
 * 纯函数，无副作用，易于测试。
 * 负责：事件权重计算、保底概率、事件类型选择、时间推进。
 */

import type { EventType, PityCounter, TimeSlot, TheaterLocation, DirectorEvent } from '../types';

// ── Base Weights ──

const BASE_WEIGHTS: Record<EventType, number> = {
    ambient:   30,
    encounter: 20,
    romantic:  20,
    callback:  15,
    conflict:  10,
    surprise:   5,
};

// ── Pity Constants ──

const PITY_BASE_CHANCE = 0.15;        // 15% base probability
const PITY_INCREMENT = 0.12;          // +12% each round without event
// Soft guarantee: ~70% at round 5
const PITY_HARD_GUARANTEE = 8;        // 100% at round 8
const PITY_COOLDOWN_ROUNDS = 2;       // 2 rounds cooldown after event

// ── Weight Computation ──

/**
 * Compute dynamic event weights based on context.
 * Returns adjusted weights that influence which event type gets rolled.
 */
export function computeWeights(
    location: TheaterLocation,
    timeSlot: TimeSlot,
    eventHistory: DirectorEvent[],
    is520: boolean,
): Record<EventType, number> {
    const w = { ...BASE_WEIGHTS };

    // 1. Location tag bonuses
    if (location.tags.includes('romantic')) {
        w.romantic += 10;
    }
    if (location.tags.includes('adventure')) {
        w.encounter += 10;
        w.surprise += 5;
    }
    if (location.tags.includes('quiet')) {
        w.ambient += 10;
        w.callback += 5;
    }
    if (location.tags.includes('crowded')) {
        w.encounter += 10;
    }

    // 2. Time-of-day modifiers
    switch (timeSlot) {
        case 'morning':
            w.ambient += 10;
            break;
        case 'afternoon':
            w.encounter += 5;
            w.surprise += 5;
            break;
        case 'evening':
            w.romantic += 15;
            break;
        case 'night':
            w.romantic += 20;
            w.callback += 10;
            w.conflict += 5;
            break;
    }

    // 3. 520 global romantic bonus
    if (is520) {
        w.romantic += 15;
    }

    // 4. Anti-repetition: reduce weight of last 2 event types
    const recentTypes = eventHistory.slice(-2).map(e => e.sceneType);
    for (const t of recentTypes) {
        w[t] = Math.max(5, w[t] - 15);
    }

    // 5. Visit frequency: more visits → more encounters & surprises
    if (location.visitCount >= 3) {
        w.encounter += 10;
        w.surprise += 10;
    }

    // 6. Emotional buffer: conflict → next event likely romantic or ambient
    const lastEvent = eventHistory[eventHistory.length - 1];
    if (lastEvent?.sceneType === 'conflict') {
        w.romantic += 20;
        w.ambient += 10;
        w.conflict = Math.max(2, w.conflict - 15);
    }

    return w;
}

// ── Weighted Random Selection ──

/**
 * Roll a random event type based on weighted probabilities.
 */
export function rollEventType(weights: Record<EventType, number>): EventType {
    const entries = Object.entries(weights) as [EventType, number][];
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (const [type, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return type;
    }

    return 'ambient'; // fallback
}

// ── Pity System ──

/**
 * Determine if an event should trigger this round.
 */
export function shouldTriggerEvent(pity: PityCounter): boolean {
    // Cooldown period: never trigger
    if (pity.cooldownRemaining > 0) return false;

    // Hard guarantee
    if (pity.roundsSinceLastEvent >= PITY_HARD_GUARANTEE) return true;

    // Calculate probability
    const probability = Math.min(1.0,
        PITY_BASE_CHANCE + PITY_INCREMENT * pity.roundsSinceLastEvent
    );

    return Math.random() < probability;
}

/**
 * Update pity counter after a round.
 * @param triggered - whether an event was triggered this round
 */
export function updatePity(pity: PityCounter, triggered: boolean): PityCounter {
    if (triggered) {
        return {
            roundsSinceLastEvent: 0,
            cooldownRemaining: PITY_COOLDOWN_ROUNDS,
            totalEventsTriggered: pity.totalEventsTriggered + 1,
        };
    }
    return {
        ...pity,
        roundsSinceLastEvent: pity.roundsSinceLastEvent + 1,
        cooldownRemaining: Math.max(0, pity.cooldownRemaining - 1),
    };
}

/**
 * Create a fresh pity counter.
 */
export function createPityCounter(): PityCounter {
    return { roundsSinceLastEvent: 0, cooldownRemaining: 0, totalEventsTriggered: 0 };
}

// ── Time Progression ──

/**
 * Calculate the time slot for a new session start based on real-world hour.
 */
export function getInitialTimeSlot(): TimeSlot {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

// ── 520 Detection ──

/**
 * Check if the current date falls within the 520 event window.
 * Event window: May 14 – May 21 (inclusive).
 */
export function is520EventActive(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed, May = 4
    const day = now.getDate();
    return month === 4 && day >= 14 && day <= 21;
}

// ── Session ID Generator ──

export function generateSessionId(): string {
    return `theater_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Auto Gradient for Director-Created Locations ──

/** 根据地点 tags 自动生成 CSS 渐变背景 */
const TAG_GRADIENT_MAP: Record<string, string> = {
    romantic: 'linear-gradient(135deg, #2d1b3d 0%, #5c2d6e 50%, #c44569 100%)',
    daily:    'linear-gradient(135deg, #2c3e50 0%, #4a6572 50%, #a8b6c0 100%)',
    adventure:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #e94560 100%)',
    quiet:    'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #8b7355 100%)',
    crowded:  'linear-gradient(135deg, #e44d26 0%, #f16529 40%, #ffd700 100%)',
    outdoor:  'linear-gradient(135deg, #0c2461 0%, #1e90ff 40%, #a8d870 100%)',
    indoor:   'linear-gradient(135deg, #3d2b1f 0%, #78593a 50%, #c49b6c 100%)',
};

export function getAutoGradient(tags: string[]): string {
    for (const tag of tags) {
        if (TAG_GRADIENT_MAP[tag]) return TAG_GRADIENT_MAP[tag];
    }
    return 'linear-gradient(135deg, #1a1a2e 0%, #243B55 50%, #4a69bd 100%)';
}
