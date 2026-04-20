import { describe, expect, it } from 'vitest';
import { ContextBuilder } from '../utils/context';
import { ChatPrompts } from '../utils/chatPrompts';

const baseCharacter = {
    id: 'char-1',
    name: '糯米',
    avatar: 'avatar.png',
    description: '',
    systemPrompt: '你是糯米。',
    worldview: '',
    refinedMemories: {},
    activeMemoryMonths: [],
    memories: [],
    mountedWorldbooks: [],
} as any;

const baseUser = {
    name: 'User',
    avatar: 'avatar.png',
    bio: 'bio',
};

describe('HalfSugar health data injection', () => {
    it('adds body information to core context only when body sharing is enabled', () => {
        const enabledContext = ContextBuilder.buildCoreContext(
            baseCharacter,
            {
                ...baseUser,
                healthShareBodyInfo: true,
                healthGender: 'female',
                healthHeight: 165,
                healthWeight: 55,
            },
            false,
            'vector',
        );

        expect(enabledContext).toContain('- 身体信息: 女，身高165cm，体重55kg，BMI 20.2');

        const disabledContext = ContextBuilder.buildCoreContext(
            baseCharacter,
            {
                ...baseUser,
                healthShareBodyInfo: false,
                healthGender: 'female',
                healthHeight: 165,
                healthWeight: 55,
            },
            false,
            'vector',
        );

        expect(disabledContext).not.toContain('身体信息:');
    });

    it('formats health_signal messages with the regular timestamp prefix', () => {
        const timestamp = new Date(2026, 3, 21, 10, 30).getTime();

        const { apiMessages } = ChatPrompts.buildMessageHistory(
            [{
                id: 1,
                charId: 'char-1',
                role: 'system',
                type: 'health_signal' as any,
                content: '[生活感知] TA早餐吃了酸奶，约120千卡',
                timestamp,
            }],
            10,
            baseCharacter,
            baseUser,
            [],
        );

        expect(apiMessages[0]).toEqual({
            role: 'system',
            content: '[2026-04-21 10:30] [生活感知] TA早餐吃了酸奶，约120千卡',
        });
    });
});
