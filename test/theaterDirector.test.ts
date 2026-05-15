import { describe, expect, it } from 'vitest';
import type { CharacterProfile, DirectorEvent, Message } from '../types';
import {
    buildRecentForbiddenMotifs,
    buildTheaterDirectorRecentContext,
    buildTraditionalCallbackMemoryContext,
    chooseDirectorEventType,
    getTheaterSummaryHiddenMsgIds,
    selectTheaterAutoSummaryTargetMessages,
    shouldTriggerEvent,
} from '../utils/theaterDirector';
import { buildDirectorPrompt } from '../utils/theaterPrompts';

const makeMessage = (id: number, role: Message['role'] = 'user'): Message => ({
    id,
    charId: 'char-1',
    role,
    type: 'text',
    content: `${role}-${id}`,
    timestamp: id,
    metadata: { source: 'theater' },
});

describe('theaterDirector', () => {
    it('uses a quieter medium-drama pity cadence', () => {
        expect(shouldTriggerEvent({
            roundsSinceLastEvent: 10,
            cooldownRemaining: 0,
            totalEventsTriggered: 0,
        })).toBe(true);
        expect(shouldTriggerEvent({
            roundsSinceLastEvent: 10,
            cooldownRemaining: 1,
            totalEventsTriggered: 0,
        })).toBe(false);
    });

    it('builds callback memory from traditional refined and active detailed memories', () => {
        const char = {
            id: 'char-1',
            name: '周放',
            avatar: '',
            description: '',
            systemPrompt: '',
            refinedMemories: {
                '2026-05': '她曾经在雨夜把伞偏向他，自己肩膀湿了一半。',
            },
            activeMemoryMonths: ['2026-05'],
            memories: [
                { id: 'm1', date: '2026/5/15', mood: 'soft', summary: '他们在便利店门口分吃一支冰淇淋。' },
            ],
        } as CharacterProfile;

        const memoryContext = buildTraditionalCallbackMemoryContext(char);
        const prompt = buildDirectorPrompt(
            '周放',
            '糯米',
            {
                id: 'home',
                name: '家里',
                description: '熟悉的客厅。',
                tags: ['quiet', 'indoor'],
                isPreset: true,
                visitCount: 1,
            },
            'night',
            'callback',
            [],
            memoryContext,
        );

        expect(memoryContext).toContain('雨夜把伞偏向他');
        expect(memoryContext).toContain('便利店门口分吃一支冰淇淋');
        expect(prompt).toContain('可用真实记忆片段');
        expect(prompt).toContain('绝不能编造');
    });

    it('rerolls callback when no real callback memory is available', () => {
        const chosen = chooseDirectorEventType(
            {
                ambient: 30,
                encounter: 20,
                romantic: 20,
                callback: 15,
                conflict: 10,
                surprise: 5,
            },
            false,
            () => 'callback',
        );

        expect(chosen).not.toBe('callback');
        expect(chosen).toBe('ambient');
    });

    it('adds recent accident motifs to the director reuse ban', () => {
        const history: DirectorEvent[] = [
            {
                sceneType: 'surprise',
                atmosphere: '街边很吵。',
                event: '外卖员骑着电动车急刹，差点撞倒他们。',
                tension: 0.6,
                suggestedBeats: [],
            },
        ];

        const motifs = buildRecentForbiddenMotifs(history);

        expect(motifs).toContain('外卖员');
        expect(motifs).toContain('电动车');
        expect(motifs).toContain('撞');
    });

    it('passes current theater context into the director prompt', () => {
        const recentContext = buildTheaterDirectorRecentContext([
            { ...makeMessage(1, 'user'), content: '“我知道了”' },
            { ...makeMessage(2, 'assistant'), content: '[normal] "别生气。"' },
        ], '周放', '糯米');
        const prompt = buildDirectorPrompt(
            '周放',
            '糯米',
            {
                id: 'home',
                name: '家里',
                description: '熟悉的客厅。',
                tags: ['quiet', 'indoor'],
                isPreset: true,
                visitCount: 1,
            },
            'night',
            'ambient',
            [],
            undefined,
            undefined,
            false,
            { recentContext },
        );

        expect(prompt).toContain('当前对话上下文');
        expect(prompt).toContain('糯米: “我知道了”');
        expect(prompt).toContain('周放: "别生气。"');
    });

    it('keeps the latest 8 messages out of automatic summary candidates', () => {
        const messages = Array.from({ length: 20 }, (_, index) => makeMessage(index + 1));

        const target = selectTheaterAutoSummaryTargetMessages(messages);

        expect(target.map(m => m.id)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
        expect(target[target.length - 1].id).toBe(12);
    });

    it('hides summarized messages while preserving an 8-message raw buffer', () => {
        expect(getTheaterSummaryHiddenMsgIds(Array.from({ length: 12 }, (_, index) => index + 1))).toEqual([1, 2, 3, 4]);
    });
});
