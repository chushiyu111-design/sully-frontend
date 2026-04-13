// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chat from './Chat';
import { useOS } from '../context/OSContext';
import { DB } from '../utils/db';

vi.mock('../context/OSContext', () => ({
    useOS: vi.fn(),
}));

vi.mock('../utils/db', () => ({
    DB: {
        getMessagesByCharId: vi.fn(() => Promise.resolve([])),
        initializeEmojiData: vi.fn(() => Promise.resolve()),
        getEmojis: vi.fn(() => Promise.resolve([])),
        getEmojiCategories: vi.fn(() => Promise.resolve([])),
    },
}));

vi.mock('../components/chat/MessageItem', () => ({
    default: () => <div>Message Item</div>,
}));

vi.mock('../components/chat/ChatHeader', () => ({
    default: () => <div>Chat Header</div>,
}));

vi.mock('../components/chat/ChatInputArea', () => ({
    default: () => <div>Chat Input</div>,
}));

vi.mock('../components/chat/ChatModals', () => ({
    default: () => null,
}));

vi.mock('../components/os/Modal', () => ({
    default: () => null,
}));

vi.mock('../hooks/useChatAI', () => ({
    useChatAI: () => ({
        isTyping: false,
        recallStatus: '',
        searchStatus: '',
        diaryStatus: '',
        weiboStatus: '',
        lastTokenUsage: null,
        tokenBreakdown: null,
        setLastTokenUsage: vi.fn(),
        triggerAI: vi.fn(),
        retryMindSnapshot: vi.fn(),
    }),
}));

vi.mock('../hooks/useVoiceTts', () => ({
    useVoiceTts: () => ({
        playingMsgId: null,
        loadingMsgIds: new Set<number>(),
        playVoice: vi.fn(),
        stopVoice: vi.fn(),
        synthesizeForMessage: vi.fn(),
    }),
}));

vi.mock('../hooks/useVoiceRecorder', () => ({
    useVoiceRecorder: () => ({
        error: '',
        state: 'idle',
        duration: 0,
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        cancelRecording: vi.fn(),
        analyserNode: null,
        isSpeaking: false,
    }),
}));

vi.mock('../utils/file', () => ({
    processImage: vi.fn(),
}));

vi.mock('../utils/safeApi', () => ({
    safeResponseJson: vi.fn(),
}));

vi.mock('../utils/chatParser', () => ({
    parseBilingual: vi.fn((content: string) => ({ langA: content, langB: '' })),
}));

vi.mock('../utils/xhsMcpClient', () => ({
    XhsMcpClient: {
        getNoteDetail: vi.fn(),
    },
    normalizeNote: vi.fn(),
}));

vi.mock('./voicecall/unlockAudio', () => ({
    unlockAudio: vi.fn(),
}));

vi.mock('../utils/cloudStt', () => ({
    CloudStt: {
        transcribe: vi.fn(),
    },
    SttNotConfiguredError: class extends Error {},
}));

vi.mock('../utils/haptics', () => ({
    haptic: {
        light: vi.fn(),
        medium: vi.fn(),
    },
}));

vi.mock('../utils/autonomousAgent', () => ({
    BackendAgentManager: {
        notifyUserReplied: vi.fn(() => Promise.resolve()),
    },
    getLifeStreamVisibleInChat: vi.fn(() => false),
    LIFE_STREAM_VISIBILITY_EVENT_NAME: 'life-stream-visibility-change',
}));

const mockedUseOS = vi.mocked(useOS);
const mockedDB = vi.mocked(DB);

function buildOsContext(overrides: Record<string, unknown> = {}) {
    return {
        characters: [
            {
                id: 'char-2',
                name: 'Backup',
                avatar: 'backup.png',
            },
        ],
        activeCharacterId: 'char-missing',
        setActiveCharacterId: vi.fn(),
        updateCharacter: vi.fn(),
        apiConfig: {
            apiKey: '',
            baseUrl: 'https://example.com',
            model: 'gpt-test',
        },
        closeApp: vi.fn(),
        openApp: vi.fn(),
        customThemes: [],
        removeCustomTheme: vi.fn(),
        addToast: vi.fn(),
        userProfile: {
            name: 'Tester',
            avatar: 'user.png',
        },
        lastMsgTimestamp: 0,
        groups: [],
        clearUnread: vi.fn(),
        realtimeConfig: {},
        ttsConfig: null,
        sttConfig: null,
        ...overrides,
    } as any;
}

describe('Chat character sync fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockedUseOS.mockReturnValue(buildOsContext());
    });

    it('renders a loading fallback instead of crashing when the active character is still syncing', async () => {
        render(<Chat />);

        expect(screen.getByText('角色资料同步中')).toBeInTheDocument();
        expect(screen.getByText('刚刚的人设改动还在切换到聊天页，等角色信息就绪后会自动进入对话。')).toBeInTheDocument();

        await waitFor(() => {
            expect(mockedDB.getMessagesByCharId).toHaveBeenCalledWith('char-missing');
        });
    });

    it('lets the user close the fallback view', async () => {
        const closeApp = vi.fn();
        mockedUseOS.mockReturnValue(buildOsContext({ closeApp }));

        render(<Chat />);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: '返回桌面' })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: '返回桌面' }));

        expect(closeApp).toHaveBeenCalledTimes(1);
    });
});
