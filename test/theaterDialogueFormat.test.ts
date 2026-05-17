import { describe, expect, it } from 'vitest';
import {
    buildTheaterUserBeatsSystemNote,
    formatTheaterUserBeatsForMessage,
    parseTheaterAssistantBeatReplyGroups,
    parseTheaterAssistantPages,
    parseTheaterUserPages,
    stripTheaterBeatMarkers,
    splitTheaterAssistantLine,
} from '../utils/theaterDialogueFormat';

describe('theaterDialogueFormat', () => {
    it('formats and parses user speech/action beats as separate VN pages', () => {
        const beats = [
            { kind: 'speech' as const, text: '我知道了' },
            { kind: 'action' as const, text: '她转过身安静了一会儿' },
            { kind: 'speech' as const, text: '难道你就没有错吗' },
        ];

        const formatted = formatTheaterUserBeatsForMessage(beats);

        expect(formatted).toBe('“我知道了”\n她转过身安静了一会儿\n“难道你就没有错吗”');
        expect(parseTheaterUserPages(formatted, 1, beats)).toEqual([
            { role: 'user', type: 'user', text: '我知道了', msgId: 1 },
            { role: 'user', type: 'narration', text: '她转过身安静了一会儿', msgId: 1 },
            { role: 'user', type: 'user', text: '难道你就没有错吗', msgId: 1 },
        ]);
    });

    it('does not duplicate quotes when user speech already includes them', () => {
        expect(formatTheaterUserBeatsForMessage([
            { kind: 'speech', text: '“我知道了”' },
            { kind: 'action', text: '她停在门口' },
        ])).toBe('“我知道了”\n她停在门口');
    });

    it('strips common paired quotes from assistant dialogue lines', () => {
        expect(parseTheaterAssistantPages('[normal] "你好。"', 'a')).toEqual([
            { role: 'assistant', type: 'dialogue', text: '你好。', msgId: 'a' },
        ]);
        expect(parseTheaterAssistantPages('[normal] “你好。”', 'b')).toEqual([
            { role: 'assistant', type: 'dialogue', text: '你好。', msgId: 'b' },
        ]);
        expect(parseTheaterAssistantPages('[normal] 「你好。」', 'c')).toEqual([
            { role: 'assistant', type: 'dialogue', text: '你好。', msgId: 'c' },
        ]);
    });

    it('splits assistant narration followed by dialogue', () => {
        expect(parseTheaterAssistantPages('[shy] 他低下头。“那你先坐。”', 2)).toEqual([
            { role: 'assistant', type: 'narration', text: '他低下头。', msgId: 2 },
            { role: 'assistant', type: 'dialogue', text: '那你先坐。', msgId: 2 },
        ]);
    });

    it('rescues screenshot-like mixed quotes instead of wrapping the whole line as dialogue', () => {
        const pages = parseTheaterAssistantPages(
            '[normal] "家里乱。"他抓了抓短发，眼神发虚，"你先随便坐，别嫌弃，我去洗个杯子。',
            3,
        );

        expect(pages).toEqual([
            { role: 'assistant', type: 'dialogue', text: '家里乱。', msgId: 3 },
            { role: 'assistant', type: 'narration', text: '他抓了抓短发，眼神发虚，', msgId: 3 },
            { role: 'assistant', type: 'dialogue', text: '你先随便坐，别嫌弃，我去洗个杯子。', msgId: 3 },
        ]);
        expect(pages.map(page => page.text).join('')).not.toContain('"');
    });

    it('keeps legacy single-line user messages as user pages', () => {
        expect(parseTheaterUserPages('我随便说一句', 4)).toEqual([
            { role: 'user', type: 'user', text: '我随便说一句', msgId: 4 },
        ]);
    });

    it('builds a compact system note for ordered user beats', () => {
        const note = buildTheaterUserBeatsSystemNote(
            [
                { kind: 'speech', text: '我知道了' },
                { kind: 'action', text: '她转过身安静了一会儿' },
            ],
            '糯米',
            '周放',
        );

        expect(note).toContain('按顺序发生的 2 个片段');
        expect(note).toContain('[emotion] <beat:N> 正文');
        expect(note).toContain('1. 台词: “我知道了”');
        expect(note).toContain('2. 动作: 她转过身安静了一会儿');
        expect(note).toContain('每一行以 [emotion] 开头');
    });

    it('groups assistant reply pages by user beat markers', () => {
        const parsed = parseTheaterAssistantBeatReplyGroups(
            '[normal] <beat:1> "我听见了。"\n[shy] <beat:2> 他停了一下。\n[angry] <beat:3> "你说得对。"',
            5,
        );

        expect(parsed.hasBeatMarkers).toBe(true);
        expect(parsed.groups.map(group => ({
            beatIndex: group.beatIndex,
            content: group.content,
            pages: group.pages,
        }))).toEqual([
            {
                beatIndex: 1,
                content: '[normal] "我听见了。"',
                pages: [{ role: 'assistant', type: 'dialogue', text: '我听见了。', msgId: 5 }],
            },
            {
                beatIndex: 2,
                content: '[shy] 他停了一下。',
                pages: [{ role: 'assistant', type: 'narration', text: '他停了一下。', msgId: 5 }],
            },
            {
                beatIndex: 3,
                content: '[angry] "你说得对。"',
                pages: [{ role: 'assistant', type: 'dialogue', text: '你说得对。', msgId: 5 }],
            },
        ]);
    });

    it('strips assistant beat markers from stored visible content', () => {
        expect(stripTheaterBeatMarkers('[normal] <beat:1> "我听见了。"\n[shy] <beat:2> 他停了一下。')).toBe(
            '[normal] "我听见了。"\n[shy] 他停了一下。',
        );
        expect(parseTheaterAssistantPages('[normal] <beat:1> "我听见了。"', 6)).toEqual([
            { role: 'assistant', type: 'dialogue', text: '我听见了。', msgId: 6 },
        ]);
    });

    it('skips a stray closing quote after sentence-ending punctuation', () => {
        expect(splitTheaterAssistantLine('家里乱。”他抓了抓短发，眼神发虚，”你先坐。')).toEqual([
            { type: 'narration', text: '家里乱。他抓了抓短发，眼神发虚，' },
            { type: 'dialogue', text: '你先坐。' },
        ]);
    });
});
