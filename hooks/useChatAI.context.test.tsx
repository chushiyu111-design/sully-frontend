// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatAI } from './useChatAI';
import { DB } from '../utils/db';
import { ChatPrompts } from '../utils/chatPrompts';
import { safeFetchJson } from '../utils/safeApi';
import { VectorMemoryExtractor } from '../utils/vectorMemoryExtractor';
import { MindSnapshotExtractor } from '../utils/mindSnapshotExtractor';
import { EventExtractor } from '../utils/eventExtractor';
import { getEmbeddingConfig, getSecondaryApiConfig, selectSecondaryApiConfig } from '../utils/runtimeConfig';
import type { CharacterProfile, Message } from '../types';

vi.mock('../utils/db', () => ({
    DB: {
        getRecentMessagesByCharId: vi.fn(),
        saveMessage: vi.fn(() => Promise.resolve(42)),
        updateMessageMetadata: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../utils/chatPrompts', () => ({
    ChatPrompts: {
        buildSystemPrompt: vi.fn(() => Promise.resolve('system prompt')),
        buildMessageHistory: vi.fn((messages: Message[]) => ({
            apiMessages: messages.map(message => ({ role: message.role, content: message.content })),
            historySlice: messages,
        })),
    },
}));

vi.mock('../utils/chatParser', () => ({
    BILINGUAL_MARKER: '%%BILINGUAL%%',
    ChatParser: {
        cleanAiSecondPass: vi.fn((content: string) => content),
        parseAndExecuteActions: vi.fn((content: string) => Promise.resolve(content)),
        sanitize: vi.fn((content: string) => content),
        splitResponse: vi.fn((content: string) => [{ type: 'text', content }]),
        hasDisplayContent: vi.fn((content: string) => content.trim().length > 0),
        chunkText: vi.fn((content: string) => [content]),
    },
}));

vi.mock('../utils/safeApi', () => ({
    safeFetchJson: vi.fn(),
}));

vi.mock('../utils/haptics', () => ({
    haptic: { light: vi.fn(), medium: vi.fn() },
    playThemeNotification: vi.fn(),
}));

vi.mock('../components/chat/ThemeRegistry', () => ({
    THEME_PLUGINS: {},
}));

vi.mock('../utils/vectorMemoryExtractor', () => ({
    VectorMemoryExtractor: { maybeExtract: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../utils/mindSnapshotExtractor', () => ({
    MindSnapshotExtractor: {
        senseBefore: vi.fn(() => Promise.resolve(null)),
        generateInnerVoice: vi.fn(() => Promise.resolve(null)),
    },
}));

vi.mock('../utils/goalService', () => ({
    loadCharacterGoals: vi.fn(() => Promise.resolve([])),
    formatGoalListStr: vi.fn(() => ''),
}));

vi.mock('../utils/eventExtractor', () => ({
    EventExtractor: { extract: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../utils/thinkingExtractor', () => ({
    extractThinking: vi.fn((content: string) => ({ thinking: '', content })),
    safeThinkingFallbackReply: vi.fn(() => 'fallback'),
}));

vi.mock('../utils/deepseekPrompts', () => ({
    isDeepSeekMode: vi.fn(() => false),
}));

vi.mock('../utils/runtimeConfig', () => ({
    DEFAULT_CHAT_TEMPERATURE: 0.85,
    getEmbeddingConfig: vi.fn(() => ({ apiKey: '' })),
    getSecondaryApiConfig: vi.fn(() => null),
    normalizeChatTemperature: vi.fn((value: unknown, fallback: number) => (
        typeof value === 'number' && Number.isFinite(value) ? value : fallback
    )),
    selectSecondaryApiConfig: vi.fn(() => null),
}));

vi.mock('../utils/autonomousAgent', () => ({
    BackendAgentManager: {
        refreshCharacterContext: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../utils/agentBackendClient', () => ({
    generateAgentScheduleRevision: vi.fn(() => Promise.resolve({ rewritten: false })),
    TODAY_SCHEDULE_UPDATED_EVENT_NAME: 'today-schedule-updated',
}));

vi.mock('./handlers/handleRecall', () => ({ handleRecall: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleSearch', () => ({ handleSearch: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleWeiboSearch', () => ({ handleWeiboSearch: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleDiaryWrite', () => ({ handleDiaryWrite: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleDiaryRead', () => ({ handleDiaryRead: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleFeishuDiary', () => ({ handleFeishuDiary: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleFeishuDiaryRead', () => ({ handleFeishuDiaryRead: vi.fn((content: string) => Promise.resolve(content)) }));
vi.mock('./handlers/handleXhsActions', () => ({ handleXhsActions: vi.fn((content: string) => Promise.resolve(content)) }));

vi.mock('../utils/musicService', () => ({
    searchSongs: vi.fn(() => Promise.resolve({ songs: [] })),
}));

vi.mock('./useAudioPlayer', () => ({
    getCurrentPlayback: vi.fn(() => null),
}));

vi.mock('../utils/playbackLyricsRuntime', () => ({
    getPlaybackLyricKey: vi.fn(() => ''),
    getPlayableLyricSnapshot: vi.fn(() => Promise.resolve(null)),
    shouldInjectPlaybackLyricSnapshot: vi.fn(() => false),
}));

vi.mock('../utils/playbackContextRuntime', () => ({
    shouldInjectPlaybackContextFromState: vi.fn(() => false),
}));

const mockedDB = vi.mocked(DB);
const mockedChatPrompts = vi.mocked(ChatPrompts);
const mockedSafeFetchJson = vi.mocked(safeFetchJson);
const mockedGetEmbeddingConfig = vi.mocked(getEmbeddingConfig);
const mockedGetSecondaryApiConfig = vi.mocked(getSecondaryApiConfig);
const mockedSelectSecondaryApiConfig = vi.mocked(selectSecondaryApiConfig);
const mockedVectorMemoryExtractor = vi.mocked(VectorMemoryExtractor);
const mockedMindSnapshotExtractor = vi.mocked(MindSnapshotExtractor);
const mockedEventExtractor = vi.mocked(EventExtractor);

function makeMessage(id: number, content: string): Message {
    return {
        id,
        charId: 'char-1',
        role: 'user',
        type: 'text',
        content,
        timestamp: 1000 + id,
    };
}

describe('useChatAI context loading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetEmbeddingConfig.mockReturnValue({ apiKey: '' } as any);
        mockedGetSecondaryApiConfig.mockReturnValue(null as any);
        mockedSelectSecondaryApiConfig.mockReturnValue(null as any);
        mockedDB.getRecentMessagesByCharId.mockResolvedValue([makeMessage(2, 'full db context')]);
        mockedSafeFetchJson.mockResolvedValue({
            choices: [{ message: { content: 'assistant reply' } }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        } as any);
    });

    it('loads AI context from DB using the character context limit', async () => {
        const setMessages = vi.fn();
        const char = {
            id: 'char-1',
            name: 'Sully',
            avatar: '',
            description: '',
            systemPrompt: '',
            memories: [],
            contextLimit: 777,
            statusBarMode: 'off',
        } as CharacterProfile;

        const { result } = renderHook(() => useChatAI({
            char,
            userProfile: { name: 'Tester', avatar: '' } as any,
            apiConfig: { baseUrl: 'https://example.test', apiKey: 'sk-test', model: 'test-model' },
            groups: [],
            emojis: [],
            categories: [],
            addToast: vi.fn(),
            setMessages,
        }));

        await act(async () => {
            await result.current.triggerAI([makeMessage(1, 'ui-visible only')]);
        });

        expect(mockedDB.getRecentMessagesByCharId).toHaveBeenCalledWith('char-1', 777);
        expect(mockedChatPrompts.buildSystemPrompt).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'char-1' }),
            expect.anything(),
            [],
            [],
            [],
            [expect.objectContaining({ content: 'full db context' })],
            undefined,
            expect.anything(),
            undefined,
            [],
        );
    });

    it('does not run secondary background tasks through the primary API when secondary API is missing', async () => {
        mockedGetEmbeddingConfig.mockReturnValue({ apiKey: 'embedding-key' } as any);
        mockedGetSecondaryApiConfig.mockReturnValue(null as any);
        mockedSelectSecondaryApiConfig.mockReturnValue(null as any);
        const setMessages = vi.fn();
        const char = {
            id: 'char-1',
            name: 'Sully',
            avatar: '',
            description: '',
            systemPrompt: '',
            memories: [],
            contextLimit: 777,
            statusBarMode: 'classic',
            vectorMemoryEnabled: true,
            vectorMemoryAutoExtract: true,
        } as CharacterProfile;

        const { result } = renderHook(() => useChatAI({
            char,
            userProfile: { name: 'Tester', avatar: '' } as any,
            apiConfig: { baseUrl: 'https://primary.example.test', apiKey: 'sk-primary', model: 'primary-model' },
            groups: [],
            emojis: [],
            categories: [],
            addToast: vi.fn(),
            setMessages,
        }));

        await act(async () => {
            await result.current.triggerAI([makeMessage(1, '明天提醒我开会')]);
        });

        expect(mockedSafeFetchJson).toHaveBeenCalledTimes(1);
        expect(mockedSafeFetchJson).toHaveBeenCalledWith(
            'https://primary.example.test/chat/completions',
            expect.objectContaining({ method: 'POST' }),
        );
        expect(mockedMindSnapshotExtractor.senseBefore).not.toHaveBeenCalled();
        expect(mockedMindSnapshotExtractor.generateInnerVoice).not.toHaveBeenCalled();
        expect(mockedVectorMemoryExtractor.maybeExtract).not.toHaveBeenCalled();
        expect(mockedEventExtractor.extract).not.toHaveBeenCalled();
    });
});
