export type TheaterBeatKind = 'speech' | 'action';

export interface TheaterUserBeat {
    kind: TheaterBeatKind;
    text: string;
}

export type TheaterVNPageType = 'dialogue' | 'narration' | 'user';

export interface TheaterVNPage {
    role: 'user' | 'assistant';
    type: TheaterVNPageType;
    text: string;
    msgId: string | number;
}

type ParsedSegment = { type: 'dialogue' | 'narration'; text: string };

export interface TheaterAssistantBeatReply {
    beatIndex: number;
    content: string;
}

export interface TheaterAssistantBeatReplyGroup extends TheaterAssistantBeatReply {
    pages: TheaterVNPage[];
}

export interface TheaterAssistantBeatReplyParseResult {
    hasBeatMarkers: boolean;
    groups: TheaterAssistantBeatReplyGroup[];
    unassignedPages: TheaterVNPage[];
}

const QUOTE_CLOSE_BY_OPEN: Record<string, string> = {
    '"': '"',
    '“': '”',
    '「': '」',
    '『': '』',
    '‘': '’',
    '”': '”',
    '」': '」',
    '』': '』',
    '’': '’',
};

const QUOTE_CHARS = new Set(Object.keys(QUOTE_CLOSE_BY_OPEN));
const CLOSING_QUOTE_CHARS = new Set(['”', '」', '』', '’']);
const SENTENCE_END_CHARS = new Set(['。', '.', '！', '!', '？', '?']);

const stripEmotionTag = (text: string) =>
    text.replace(/^\s*(?:\[[a-zA-Z0-9_-]+\]\s*)+/, '').trim();

const LEADING_BEAT_MARKER_RE = /^(\s*(?:\[[a-zA-Z0-9_-]+\]\s*)*)<beat:(\d+)>\s*/i;

const stripLeadingBeatMarker = (line: string) =>
    line.replace(LEADING_BEAT_MARKER_RE, '$1');

const extractLeadingBeatMarker = (line: string): { beatIndex?: number; line: string } => {
    const match = line.match(LEADING_BEAT_MARKER_RE);
    if (!match) return { line };
    return {
        beatIndex: Number(match[2]),
        line: line.replace(LEADING_BEAT_MARKER_RE, '$1'),
    };
};

export const stripTheaterBeatMarkers = (text: string): string =>
    text
        .split('\n')
        .map(stripLeadingBeatMarker)
        .join('\n');

const trimDanglingQuotes = (text: string) => {
    let value = text.trim();
    while (value && QUOTE_CHARS.has(value[0])) value = value.slice(1).trimStart();
    while (value && QUOTE_CHARS.has(value[value.length - 1])) value = value.slice(0, -1).trimEnd();
    return value;
};

const getPrevNonSpace = (value: string, index: number) => {
    for (let i = index; i >= 0; i--) {
        if (!/\s/.test(value[i])) return value[i];
    }
    return '';
};

export const stripOuterDialogueQuotes = (text: string): string => {
    const value = text.trim();
    if (!value) return '';

    for (const [open, close] of Object.entries(QUOTE_CLOSE_BY_OPEN)) {
        if (value.startsWith(open) && value.endsWith(close) && value.length >= 2) {
            return value.slice(open.length, value.length - close.length).trim();
        }
    }

    return trimDanglingQuotes(value);
};

export const sanitizeTheaterUserBeats = (beats: TheaterUserBeat[]): TheaterUserBeat[] =>
    beats
        .map(beat => ({
            kind: beat.kind,
            text: beat.text.trim(),
        }))
        .filter(beat => beat.text.length > 0);

export const formatTheaterUserBeatsForMessage = (beats: TheaterUserBeat[]): string =>
    sanitizeTheaterUserBeats(beats)
        .map(beat => {
            const text = stripOuterDialogueQuotes(beat.text);
            return beat.kind === 'speech' ? `“${text}”` : text;
        })
        .join('\n');

function pushSegment(segments: ParsedSegment[], type: ParsedSegment['type'], text: string) {
    const cleaned = trimDanglingQuotes(text);
    if (!cleaned) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === type) {
        previous.text = `${previous.text}${cleaned}`;
    } else {
        segments.push({ type, text: cleaned });
    }
}

export function splitTheaterAssistantLine(line: string): ParsedSegment[] {
    const clean = stripEmotionTag(stripLeadingBeatMarker(line));
    if (!clean) return [];

    const segments: ParsedSegment[] = [];
    let mode: ParsedSegment['type'] = 'narration';
    let closeQuote = '';
    let buffer = '';

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        const isQuote = QUOTE_CHARS.has(char);

        if (mode === 'narration' && isQuote) {
            const prev = getPrevNonSpace(clean, i - 1);
            if (CLOSING_QUOTE_CHARS.has(char) && prev && SENTENCE_END_CHARS.has(prev)) {
                continue;
            }
            pushSegment(segments, 'narration', buffer);
            buffer = '';
            mode = 'dialogue';
            closeQuote = QUOTE_CLOSE_BY_OPEN[char] || char;
            continue;
        }

        if (mode === 'dialogue' && isQuote && char === closeQuote) {
            pushSegment(segments, 'dialogue', buffer);
            buffer = '';
            mode = 'narration';
            closeQuote = '';
            continue;
        }

        buffer += char;
    }

    pushSegment(segments, mode, buffer);
    return segments.length > 0 ? segments : [{ type: 'narration', text: clean }];
}

export function parseTheaterAssistantPages(content: string, msgId: string | number): TheaterVNPage[] {
    return content
        .split('\n')
        .flatMap(line => splitTheaterAssistantLine(line))
        .map(segment => ({
            role: 'assistant' as const,
            type: segment.type,
            text: segment.text,
            msgId,
        }))
        .filter(page => page.text.length > 0);
}

export function parseTheaterAssistantBeatReplyGroups(
    content: string,
    msgId: string | number,
): TheaterAssistantBeatReplyParseResult {
    const groupMap = new Map<number, { contentLines: string[]; pages: TheaterVNPage[] }>();
    const unassignedPages: TheaterVNPage[] = [];
    let hasBeatMarkers = false;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const marker = extractLeadingBeatMarker(trimmed);
        const pages = splitTheaterAssistantLine(marker.line).map(segment => ({
            role: 'assistant' as const,
            type: segment.type,
            text: segment.text,
            msgId,
        }));

        if (marker.beatIndex && Number.isFinite(marker.beatIndex)) {
            hasBeatMarkers = true;
            const existing = groupMap.get(marker.beatIndex) || { contentLines: [], pages: [] };
            existing.contentLines.push(marker.line);
            existing.pages.push(...pages);
            groupMap.set(marker.beatIndex, existing);
        } else {
            unassignedPages.push(...pages);
        }
    }

    const groups = Array.from(groupMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([beatIndex, group]) => ({
            beatIndex,
            content: group.contentLines.join('\n'),
            pages: group.pages.filter(page => page.text.length > 0),
        }))
        .filter(group => group.pages.length > 0 || group.content.trim().length > 0);

    return {
        hasBeatMarkers,
        groups,
        unassignedPages: unassignedPages.filter(page => page.text.length > 0),
    };
}

export function parseTheaterUserPages(
    content: string,
    msgId: string | number,
    beats?: TheaterUserBeat[],
): TheaterVNPage[] {
    const normalizedBeats = beats ? sanitizeTheaterUserBeats(beats) : [];

    if (normalizedBeats.length > 0) {
        return normalizedBeats.map(beat => ({
            role: 'user' as const,
            type: beat.kind === 'speech' ? 'user' as const : 'narration' as const,
            text: beat.kind === 'speech' ? stripOuterDialogueQuotes(beat.text) : beat.text.trim(),
            msgId,
        }));
    }

    const lines = content
        .split('\n')
        .map(line => stripEmotionTag(line))
        .filter(line => line.length > 0);

    if (lines.length === 0) return [];
    if (lines.length === 1 && splitTheaterAssistantLine(lines[0]).every(segment => segment.type !== 'dialogue')) {
        return [{ role: 'user', type: 'user', text: lines[0], msgId }];
    }

    return lines.flatMap(line => {
        const segments = splitTheaterAssistantLine(line);
        if (segments.length === 1 && segments[0].type === 'narration') {
            return [{ role: 'user' as const, type: 'narration' as const, text: segments[0].text, msgId }];
        }
        return segments.map(segment => ({
            role: 'user' as const,
            type: segment.type === 'dialogue' ? 'user' as const : 'narration' as const,
            text: segment.text,
            msgId,
        }));
    });
}

export function buildTheaterUserBeatsSystemNote(
    beats: TheaterUserBeat[] | undefined,
    userName: string,
    charName: string,
): string {
    const normalized = beats ? sanitizeTheaterUserBeats(beats) : [];
    if (normalized.length === 0) return '';

    const beatLines = normalized
        .map((beat, index) => {
            const label = beat.kind === 'speech' ? '台词' : '动作';
            const text = beat.kind === 'speech'
                ? `“${stripOuterDialogueQuotes(beat.text)}”`
                : beat.text.trim();
            return `${index + 1}. ${label}: ${text}`;
        })
        .join('\n');

    const interleaveRule = normalized.length > 1
        ? `\n为了让前端按「${userName}片段 → ${charName}回应」穿插播放，你的每一行正文必须写成：[emotion] <beat:N> 正文。N 对应上方片段序号；每个片段至少回应一行。如果一个片段只需要沉默，也写一个动作行。不要输出小标题、编号或解释。`
        : '';

    return `\n\n(System: ${userName} 本轮输入包含按顺序发生的 ${normalized.length} 个片段。请按顺序理解并回应这些片段，不要只回应最后一句。你仍然只输出 ${charName} 自己的动作/台词，每一行以 [emotion] 开头。${interleaveRule}\n${beatLines})`;
}
