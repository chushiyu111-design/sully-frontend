import { describe, expect, it } from 'vitest';
import {
    buildReplyToFromMessage,
    resolveReplyTargetFromContent,
    stripLeakedVoiceContextTags,
} from '../utils/chatQuote';
import type { Message } from '../types';

function msg(overrides: Partial<Message>): Message {
    return {
        id: 1,
        charId: 'char-1',
        role: 'user',
        type: 'text',
        content: '',
        timestamp: 1,
        ...overrides,
    };
}

describe('chat quote helpers', () => {
    it('resolves QUOTE markers against transcribed user voice messages', () => {
        const voice = msg({
            id: 7,
            type: 'voice',
            content: '晚安，雪梨。我守着你。',
            metadata: { duration: 6, transcribedText: '晚安，雪梨。我守着你。' },
        });

        const result = resolveReplyTargetFromContent(
            '[[QUOTE: [🎤用户语音] 晚安，雪梨。我守着你。]] 好好睡。',
            [voice],
            '雪梨',
        );

        expect(result.content).toBe('好好睡。');
        expect(result.replyTo).toEqual({
            id: 7,
            content: '晚安，雪梨。我守着你。',
            name: '雪梨',
            type: 'voice',
            duration: 6,
        });
    });

    it('builds a readable fallback preview for voice messages without transcript', () => {
        const voice = msg({
            id: 8,
            type: 'voice',
            content: '',
            metadata: { duration: 3 },
        });

        expect(buildReplyToFromMessage(voice, '我')).toEqual({
            id: 8,
            content: '语音消息 3秒',
            name: '我',
            type: 'voice',
            duration: 3,
        });
    });

    it('strips leaked voice context tags without touching real voice-send tags', () => {
        expect(stripLeakedVoiceContextTags('[你上一条语音] 晚安，雪梨。')).toBe('晚安，雪梨。');
        expect(stripLeakedVoiceContextTags('【语音消息：晚安，雪梨。】')).toBe('【语音消息：晚安，雪梨。】');
    });
});
