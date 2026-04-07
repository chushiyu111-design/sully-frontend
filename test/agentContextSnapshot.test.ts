import { describe,expect,it } from 'vitest';

import { buildCoreMemoryDigest,buildMountedWorldbooksDigest } from '../utils/agentContextSnapshot';

describe('agentContextSnapshot', () => {
    it('prefers refinedMemories over topMemory fallback', () => {
        const digest = buildCoreMemoryDigest(
            {
                refinedMemories: {
                    '2026-03': '三月里他总在下班后绕远路去河边透气。',
                    '2026-02': '二月开始习惯在楼下便利店买热咖啡再回去。',
                },
                activeMemoryMonths: ['2026-03'],
            },
            'TopMemory: 这是旧回退',
        );

        expect(digest).toContain('[2026-03]');
        expect(digest).toContain('河边透气');
        expect(digest).not.toContain('TopMemory: 这是旧回退');
    });

    it('falls back to topMemory when refinedMemories are unavailable', () => {
        const digest = buildCoreMemoryDigest(
            {
                refinedMemories: {},
                activeMemoryMonths: [],
            },
            'TopMemory: 只剩这一条高权重记忆',
        );

        expect(digest).toBe('TopMemory: 只剩这一条高权重记忆');
    });

    it('compresses mounted worldbooks into a bounded digest', () => {
        const digest = buildMountedWorldbooksDigest([
            {
                id: 'wb-1',
                title: '旧城区规则',
                category: 'world',
                content: '他住在一座阴雨很多的旧城区，通勤和散步都绕不开河道与坡路。',
            },
            {
                id: 'wb-2',
                title: '生活习惯',
                category: 'habits',
                content: '比起热闹的场合，他更常在咖啡店、图书馆或便利店门口短暂停一下。',
            },
        ]);

        expect(digest).toContain('旧城区规则');
        expect(digest).toContain('生活习惯');
        expect(digest!.length).toBeLessThanOrEqual(1200);
    });
});
