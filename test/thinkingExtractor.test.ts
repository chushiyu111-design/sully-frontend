import { describe, expect, it } from 'vitest';
import {
    extractThinking,
    safeThinkingFallbackReply,
    stripCoTResidual,
    THINKING_CONTENT_FALLBACK_REPLY,
} from '../utils/thinkingExtractor';

describe('thinkingExtractor', () => {
    it('extracts closed thinking tags without leaking them into content', () => {
        const result = extractThinking('<thinking>先理解一下</thinking>正文来了');

        expect(result.thinking).toBe('先理解一下');
        expect(result.content).toBe('正文来了');
    });

    it('does not expose unclosed thinking as display content', () => {
        const result = extractThinking('<thinking>还在想，只有思考链');

        expect(result.thinking).toBe('还在想，只有思考链');
        expect(result.content).toBe('');
    });

    it('strips Step-style COT residuals and keeps following content', () => {
        const result = stripCoTResidual(`Step 0 — 规则就位
a. 我是谁
━━━━━━━━━━━━
正文来了`);

        expect(result).toBe('正文来了');
    });

    it('returns empty content when Step-style residuals contain no actual reply', () => {
        const result = stripCoTResidual(`Step 0 — 规则就位
a. 我是谁
━━━━━━━━━━━━`);

        expect(result).toBe('');
    });

    it('uses a safe fallback instead of exposing thinking content', () => {
        const secretThinking = '这里是不能给用户看的思考链';
        const fallback = safeThinkingFallbackReply(secretThinking);

        expect(fallback).toBe(THINKING_CONTENT_FALLBACK_REPLY);
        expect(fallback).not.toContain(secretThinking);
    });
});
