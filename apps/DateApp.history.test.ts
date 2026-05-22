// @vitest-environment jsdom

import { describe,expect,it } from 'vitest';
import { buildDateForkBridgeContent,buildDateForkOpeningText,buildHistorySessions } from './DateApp';
import type { Message } from '../types';

const makeMessage = (
    id: number,
    timestamp: number,
    metadata: Record<string, unknown>,
    role: Message['role'] = 'assistant',
): Message => ({
    id,
    charId: 'char-1',
    role,
    type: 'text',
    content: `message-${id}`,
    timestamp,
    metadata,
});

describe('buildHistorySessions', () => {
    it('shows hidden summarized date dialogue in history while keeping summaries and bridges separate', () => {
        const opening = makeMessage(1, 1_000, { source: 'date', isOpening: true });
        const hiddenUser = makeMessage(2, 2_000, {
            source: 'date',
            hiddenFromUser: true,
            dateSummaryAutoHidden: true,
            hiddenBySummaryMsgId: 4,
        }, 'user');
        const hiddenAssistant = makeMessage(3, 3_000, {
            source: 'date',
            hiddenFromUser: true,
            dateSummaryAutoHidden: true,
            hiddenBySummaryMsgId: 4,
        });
        const summary = makeMessage(4, 4_000, {
            source: 'date',
            hiddenFromUser: true,
            isSummary: true,
            summaryType: 'auto',
            sessionStartMsgId: 1,
            coveredMsgIds: [1, 2, 3],
        }, 'system');
        const bridge = makeMessage(5, 5_000, {
            source: 'date',
            hiddenFromUser: true,
            isDateContextBridge: true,
            bridgeType: 'summary',
            sessionStartMsgId: 1,
            coveredMsgIds: [1, 2, 3],
        }, 'system');
        const normalChat = makeMessage(6, 6_000, { source: 'chat', hiddenFromUser: true });

        const sessions = buildHistorySessions([
            normalChat,
            bridge,
            summary,
            hiddenAssistant,
            hiddenUser,
            opening,
        ]);

        expect(sessions).toHaveLength(1);
        expect(sessions[0].msgs.map(m => m.id)).toEqual([1, 2, 3]);
        expect(sessions[0].msgs.every(m => m.metadata?.source === 'date')).toBe(true);
        expect(sessions[0].summaries.map(m => m.id)).toEqual([4]);
        expect(sessions[0].bridges.map(m => m.id)).toEqual([5]);
    });

    it('keeps a fork bridge attached to the new copied date session', () => {
        const oldOpening = makeMessage(1, 1_000, { source: 'date', isOpening: true });
        const oldUser = makeMessage(2, 2_000, { source: 'date' }, 'user');
        const newOpening = makeMessage(10, 10_000, {
            source: 'date',
            isOpening: true,
            forkedFromSessionStartMsgId: 1,
        });
        const forkBridge = makeMessage(11, 10_001, {
            source: 'date',
            hiddenFromUser: true,
            isDateContextBridge: true,
            bridgeType: 'fork',
            sessionStartMsgId: 10,
            forkedFromSessionStartMsgId: 1,
            forkedFromMessageIds: [1, 2],
        }, 'system');

        const sessions = buildHistorySessions([oldOpening, oldUser, newOpening, forkBridge]);

        expect(sessions).toHaveLength(2);
        expect(sessions[0].startMsgId).toBe(10);
        expect(sessions[0].msgs.map(m => m.id)).toEqual([10]);
        expect(sessions[0].bridges.map(m => m.id)).toEqual([11]);
        expect(sessions[1].startMsgId).toBe(1);
        expect(sessions[1].msgs.map(m => m.id)).toEqual([1, 2]);
        expect(sessions[1].bridges).toHaveLength(0);
    });

    it('builds an immersive fork opening and hidden bridge context', () => {
        const session = buildHistorySessions([
            makeMessage(1, 1_000, { source: 'date', isOpening: true }),
            makeMessage(2, 2_000, { source: 'date' }, 'user'),
            makeMessage(3, 3_000, {
                source: 'date',
                hiddenFromUser: true,
                isSummary: true,
                summaryType: 'manual',
                sessionStartMsgId: 1,
            }, 'system'),
        ])[0];

        const opening = buildDateForkOpeningText({ charName: 'Sully', userName: '小米' });
        const bridge = buildDateForkBridgeContent({ session, charName: 'Sully', userName: '小米' });

        expect(opening).toContain('[normal]');
        expect(opening).toContain('Sully');
        expect(opening).toContain('小米');
        expect(bridge).toContain('旧见面分岔背景');
        expect(bridge).toContain('已有总结 1');
        expect(bridge).toContain('Sully: message-1');
        expect(bridge).toContain('小米: message-2');
    });
});
