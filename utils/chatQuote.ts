import type { Message, MessageType } from '../types';

type ReplyTo = NonNullable<Message['replyTo']>;

const QUOTE_RE_DOUBLE = /\[\[(?:QU[OA]TE|引用)[：:]\s*([\s\S]*?)\]\]/;
const QUOTE_RE_SINGLE = /\[(?:QU[OA]TE|引用)[：:]\s*([^\]]*)\]/;
const REPLY_RE_CN = /\[回复\s*[""\u201C]([^""\u201D]*?)[""\u201D](?:\.{0,3})\]\s*[：:]?\s*/;

const QUOTE_CLEAN_DOUBLE = /\[\[(?:QU[OA]TE|引用)[：:][\s\S]*?\]\]/g;
const QUOTE_CLEAN_SINGLE = /\[(?:QU[OA]TE|引用)[：:][^\]]*\]/g;
const REPLY_CLEAN_CN = /\[回复\s*[""\u201C][^""\u201D]*?[""\u201D](?:\.{0,3})\]\s*[：:]?\s*/g;

const LEAKED_VOICE_CONTEXT_TAG_RE = /[【\[]\s*(?:(?:🎤\s*)?(?:用户)?语音|(?:你|我|用户|对方|TA|ta)?(?:的)?(?:上一条|上条|上一段|刚才那条|刚刚那条|刚才|刚刚|前一条|那条)?语音(?:消息)?|(?:用户|你|我)?(?:发来|发送了?|发了)(?:一条)?语音(?:消息)?)(?:[（(]\s*\d+\s*(?:秒|s|sec)?\s*[）)])?\s*[】\]]/g;

function compactText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export function stripLeakedVoiceContextTags(text: string): string {
    return text
        .replace(LEAKED_VOICE_CONTEXT_TAG_RE, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^[ \t]+|[ \t]+$/gm, '')
        .trim();
}

export function getMessageQuoteText(message: Message): string {
    if (message.type === 'voice') {
        return stripLeakedVoiceContextTags(String(
            message.metadata?.sourceText
            || message.metadata?.transcribedText
            || message.content
            || '',
        ));
    }

    return stripLeakedVoiceContextTags(message.content || '');
}

function normalizeQuoteLookupText(text: string): string {
    return compactText(stripLeakedVoiceContextTags(text))
        .replace(/[“”"「」『』]/g, '')
        .toLowerCase();
}

function getReplyPreviewContent(message: Message): string {
    const quoteText = compactText(getMessageQuoteText(message));
    if (quoteText) {
        return quoteText.length > 18 ? `${quoteText.slice(0, 18)}...` : quoteText;
    }

    if (message.type === 'voice') {
        const duration = message.metadata?.duration;
        return duration ? `语音消息 ${duration}秒` : '语音消息';
    }

    return message.content.length > 18 ? `${message.content.slice(0, 18)}...` : message.content;
}

export function buildReplyToFromMessage(message: Message, name: string): ReplyTo {
    const reply: ReplyTo = {
        id: message.id,
        content: getReplyPreviewContent(message),
        name,
    };

    if (message.type) reply.type = message.type as MessageType;
    if (message.type === 'voice' && typeof message.metadata?.duration === 'number') {
        reply.duration = message.metadata.duration;
    }

    return reply;
}

export function stripQuoteMarkers(text: string): string {
    return text
        .replace(QUOTE_CLEAN_DOUBLE, '')
        .replace(QUOTE_CLEAN_SINGLE, '')
        .replace(REPLY_CLEAN_CN, '')
        .trim();
}

export function resolveReplyTargetFromContent(
    content: string,
    historySlice: Message[],
    userName: string,
): { content: string; replyTo?: ReplyTo } {
    const firstQuoteMatch = content.match(QUOTE_RE_DOUBLE) || content.match(QUOTE_RE_SINGLE) || content.match(REPLY_RE_CN);
    if (!firstQuoteMatch) return { content };

    const quotedText = stripLeakedVoiceContextTags(firstQuoteMatch[1].trim());
    const normalizedQuote = normalizeQuoteLookupText(quotedText);
    let targetMsg: Message | undefined;

    if (normalizedQuote) {
        const userMessages = historySlice.slice().reverse().filter((message) => message.role === 'user');
        targetMsg = userMessages.find((message) => {
            const candidate = normalizeQuoteLookupText(getMessageQuoteText(message));
            return candidate.length > 0 && candidate.includes(normalizedQuote);
        });

        if (!targetMsg && normalizedQuote.length > 10) {
            const fuzzyHead = normalizedQuote.slice(0, 10);
            targetMsg = userMessages.find((message) => {
                const candidate = normalizeQuoteLookupText(getMessageQuoteText(message));
                return candidate.length > 0 && candidate.includes(fuzzyHead);
            });
        }
    }

    return {
        content: stripQuoteMarkers(content),
        replyTo: targetMsg ? buildReplyToFromMessage(targetMsg, userName) : undefined,
    };
}
