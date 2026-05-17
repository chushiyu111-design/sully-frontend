import { describe, expect, it } from 'vitest';
import type { CharacterProfile, Message, UserProfile } from '../types';
import { ContextBuilder } from '../utils/context';
import {
    buildFarewellPrompt,
    buildGiftExchangePrompt,
    buildMetaLetterPrompt,
    formatSessionContextForEnding,
} from '../utils/dateEndingPrompts';

const makeMessage = (
    id: number,
    role: Message['role'],
    content: string,
    metadata: Record<string, any> = { source: 'theater' },
): Message => ({
    id,
    charId: 'char-ending',
    role,
    type: 'text',
    content,
    timestamp: id,
    metadata,
});

describe('date ending prompts', () => {
    it('formats a full ending context without truncating the current worldline record', () => {
        const messages = Array.from({ length: 35 }, (_, index) => {
            const id = index + 1;
            return makeMessage(
                id,
                id % 2 === 0 ? 'assistant' : 'user',
                `[normal] 完整世界线对话-${id}`,
            );
        });
        messages.push(makeMessage(36, 'user', '用户送出一张手写便签', {
            source: 'theater',
            isEndingCeremony: true,
            endingAct: 'user-gift',
        }));
        messages.push(makeMessage(37, 'assistant', '[shy] "我把今天的票根夹给你。"', {
            source: 'theater',
            isEndingCeremony: true,
            endingAct: 'gift-reaction',
        }));

        const context = formatSessionContextForEnding(messages, '周放', '糯米', {
            locationName: '旧电影院',
            timeSlotLabel: '夜晚',
            timelineLabel: '雨夜分支',
            savedSummaries: [
                makeMessage(90, 'system', '阶段总结：她在门口等他把伞收好。', { source: 'theater', isSummary: true }),
            ],
            eventHistory: [
                {
                    sceneType: 'ambient',
                    event: '电影散场后，街边灯牌还亮着。',
                    atmosphere: '潮湿、安静',
                    tension: 0.2,
                    suggestedBeats: [],
                },
            ],
            currentEvent: {
                sceneType: 'romantic',
                event: '他把饮料杯往她那边推近一点。',
                atmosphere: '安静、靠近',
                tension: 0.35,
                suggestedBeats: [],
            },
        });

        expect(context).toContain('<ending_context>');
        expect(context).toContain('520 约会剧场');
        expect(context).toContain('- 世界线: 雨夜分支');
        expect(context).toContain('- 当前地点: 旧电影院');
        expect(context).toContain('阶段总结：她在门口等他把伞收好。');
        expect(context).toContain('电影散场后，街边灯牌还亮着。');
        expect(context).toContain('完整世界线对话-1');
        expect(context).toContain('完整世界线对话-35');
        expect(context).toContain('【用户送出的礼物】糯米: 用户送出一张手写便签');
        expect(context).toContain('【角色回礼】周放: "我把今天的票根夹给你。"');
    });

    it('builds ending system context with profile, impression, worldbooks, refined memory, and active detailed memory', () => {
        const user: UserProfile = {
            name: '糯米',
            avatar: '',
            bio: '用户备注：喜欢慢一点的回应。',
        };
        const char = {
            id: 'char-ending',
            name: '周放',
            avatar: '',
            description: '用户备注：会叫他阿放。',
            systemPrompt: '人设核心：说话直接，但会照顾对方的节奏。',
            worldview: '世界观：他们生活在一座常年下雨的海边城市。',
            mountedWorldbooks: [
                { id: 'wb-top', title: '前置', content: '前置世界书：520 当天街区有晚灯。', position: 'top' },
                { id: 'wb-after-world', title: '世界观后', content: '世界观后世界书：旧电影院只在节日开夜场。', position: 'after_worldview' },
                { id: 'wb-after-imp', title: '印象后', content: '印象后世界书：他会把紧张藏在很短的停顿里。', position: 'after_impression' },
                { id: 'wb-bottom', title: '底部', content: '底部世界书：不要替用户做选择。', position: 'bottom' },
            ],
            impression: {
                version: 1,
                value_map: {
                    likes: ['被认真听完'],
                    dislikes: ['被催促'],
                    core_values: '尊重边界',
                },
                behavior_profile: {
                    tone_style: '慢热',
                    emotion_summary: '容易被具体细节打动',
                    response_patterns: '先观察，再回应',
                },
                emotion_schema: {
                    triggers: {
                        positive: ['被记得小习惯'],
                        negative: ['被替她决定'],
                    },
                    comfort_zone: '可以留白的相处',
                    stress_signals: ['沉默'],
                },
                personality_core: {
                    observed_traits: ['细腻', '敏感但清醒'],
                    interaction_style: '需要被平等对待',
                    summary: '核心评价：她会把真心藏在很轻的玩笑里。',
                },
                observed_changes: ['最近更愿意直接说想要什么。'],
            },
            refinedMemories: {
                '2026-05': '核心记忆：她在雨夜把伞往他那边偏。',
            },
            activeMemoryMonths: ['2026-05'],
            memories: [
                { id: 'm1', date: '2026/5/15', mood: 'soft', summary: '激活详细记忆：他们在便利店门口分一支冰淇淋。' },
                { id: 'm2', date: '2026/4/01', mood: 'calm', summary: '非激活月份记忆。' },
            ],
        } as CharacterProfile;

        const coreContext = ContextBuilder.buildCoreContext(char, user, true);

        expect(coreContext).toContain('人设核心：说话直接');
        expect(coreContext).toContain('用户备注：会叫他阿放。');
        expect(coreContext).toContain('世界观：他们生活在一座常年下雨的海边城市。');
        expect(coreContext).toContain('前置世界书：520 当天街区有晚灯。');
        expect(coreContext).toContain('世界观后世界书：旧电影院只在节日开夜场。');
        expect(coreContext).toContain('印象后世界书：他会把紧张藏在很短的停顿里。');
        expect(coreContext).toContain('底部世界书：不要替用户做选择。');
        expect(coreContext).toContain('她会把真心藏在很轻的玩笑里。');
        expect(coreContext).toContain('TA的喜好: 被认真听完');
        expect(coreContext).toContain('核心记忆：她在雨夜把伞往他那边偏。');
        expect(coreContext).toContain('激活详细记忆：他们在便利店门口分一支冰淇淋。');
        expect(coreContext).not.toContain('非激活月份记忆。');
    });

    it('keeps the ending draft prompts concrete and respectful', () => {
        const context = '<ending_context>今天在旧电影院散场。</ending_context>';

        expect(buildGiftExchangePrompt('周放', '糯米', '一张便签', context)).toContain('不要把礼物夸成宏大的象征');
        expect(buildFarewellPrompt('周放', '糯米', context)).toContain('不要替糯米安排反应');
        expect(buildFarewellPrompt('周放', '糯米', context)).toContain('情绪落在具体细节里');
        expect(buildMetaLetterPrompt('周放', '糯米', context)).toContain('不要把它写得沉重');
    });
});
