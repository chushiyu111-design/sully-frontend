// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoveShowApp from './LoveShowApp';
import { useOS } from '../../context/OSContext';
import { getActiveSeason, getCharacterState, getImpression } from '../../utils/db/loveshowStore';

vi.mock('../../context/OSContext', () => ({
    useOS: vi.fn(),
}));

vi.mock('../../utils/runtimeConfig', async () => {
    const actual = await vi.importActual<typeof import('../../utils/runtimeConfig')>('../../utils/runtimeConfig');
    return {
        ...actual,
        getSecondaryApiConfig: vi.fn(() => undefined),
    };
});

const mockedUseOS = vi.mocked(useOS);

const baseCharacter = {
    id: 'char-a',
    name: '阿昊',
    avatar: '',
    description: '咖啡师',
    systemPrompt: '你是阿昊。',
    memories: [],
};

function mockOs(overrides: Record<string, unknown> = {}) {
    const addToast = vi.fn();
    mockedUseOS.mockReturnValue({
        activeCharacterId: 'char-a',
        addToast,
        apiConfig: { baseUrl: '', apiKey: '', model: '' },
        characters: [baseCharacter],
        closeApp: vi.fn(),
        openApp: vi.fn(),
        userProfile: {
            name: '糯米',
            avatar: '',
            bio: '',
        },
        ...overrides,
    } as any);
    return { addToast };
}

describe('LoveShowApp Phase 1 shell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockOs();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('creates and restores an active season with character state and impression', async () => {
        const firstRender = render(<LoveShowApp />);

        await waitFor(() => {
            expect(getActiveSeason()?.charIds).toEqual(['char-a']);
        });

        const firstSeasonId = getActiveSeason()?.seasonId;
        expect(firstSeasonId).toBeTruthy();
        expect(getCharacterState(firstSeasonId!, 'char-a')).toBeTruthy();
        expect(getImpression(firstSeasonId!, 'char-a')).toBeTruthy();
        expect(screen.getByText('恋综')).toBeTruthy();

        firstRender.unmount();
        render(<LoveShowApp />);

        await waitFor(() => {
            expect(getActiveSeason()?.seasonId).toBe(firstSeasonId);
        });
    });

    it('advances phone choices and creates a one-on-one date-card scene', async () => {
        render(<LoveShowApp />);

        fireEvent.click(await screen.findByLabelText('打开小手机'));
        expect(screen.getByText('节目组通知')).toBeTruthy();

        fireEvent.click(screen.getByText('确认参加'));
        fireEvent.click(await screen.findByLabelText('打开小手机'));

        expect(screen.getByText(/约会券/)).toBeTruthy();
        const optionLabels = screen.getAllByText('阿昊');
        fireEvent.click(optionLabels[optionLabels.length - 1]);
        fireEvent.click(screen.getByText('提交选择'));

        await waitFor(() => {
            expect(screen.getByText(/给我吗/)).toBeTruthy();
        });
    });

    it('preserves user text and exposes retry when the main API fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network fail'));
        vi.stubGlobal('fetch', fetchMock);
        const { addToast } = mockOs({
            apiConfig: {
                baseUrl: 'https://api.example.com',
                apiKey: 'test-key',
                model: 'test-model',
            },
        });

        render(<LoveShowApp />);

        const input = await screen.findByLabelText('LoveShow message');
        fireEvent.change(input, { target: { value: '我有点紧张' } });
        fireEvent.click(screen.getByLabelText('发送'));

        await waitFor(() => {
            expect(screen.getByText('我有点紧张')).toBeTruthy();
        });
        await waitFor(() => {
            expect(screen.getByText('network fail')).toBeTruthy();
        });

        expect(screen.getByText('重试')).toBeTruthy();
        expect(addToast).toHaveBeenCalledWith('network fail', 'error');
    });
});
