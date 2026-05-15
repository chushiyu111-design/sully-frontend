// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CharacterLifeProfileCard from './CharacterLifeProfileCard';
import {
    fetchAgentLifeProfile,
    generateAgentLifeProfile,
} from '../../utils/agentBackendClient';
import { buildLifeProfileContextSnapshot } from '../../utils/lifeProfileContextSnapshot';

vi.mock('../../utils/agentBackendClient', () => ({
    fetchAgentLifeProfile: vi.fn(),
    generateAgentLifeProfile: vi.fn(),
}));

vi.mock('../../utils/lifeProfileContextSnapshot', () => ({
    buildLifeProfileContextSnapshot: vi.fn(),
}));

vi.mock('../../utils/runtimeConfig', () => ({
    getSecondaryApiConfig: vi.fn(() => ({
        baseUrl: 'https://llm.example.com',
        apiKey: 'sub-key',
        model: 'profile-model',
    })),
}));

const mockedFetchAgentLifeProfile = vi.mocked(fetchAgentLifeProfile);
const mockedGenerateAgentLifeProfile = vi.mocked(generateAgentLifeProfile);
const mockedBuildLifeProfileContextSnapshot = vi.mocked(buildLifeProfileContextSnapshot);

const addToast = vi.fn();
const character = {
    id: 'char-1',
    name: 'Sully',
    avatar: 'avatar.png',
    description: '城市里的温柔角色',
    systemPrompt: '角色人设',
    worldview: '现代城市',
    memories: [],
} as any;

const readyState = {
    status: 'ready' as const,
    updatedAt: 1,
    sourceFingerprint: 'abc123',
    profile: {
        summary: '她的生活以稳定工作和安静休息为底色。',
        lifeIdentity: { currentRole: '已工作的城市居民' },
        weeklyRhythm: { workdays: '工作日有通勤和工作。' },
        timeRhythm: { sleepWake: '普通作息。' },
        placeModel: {
            genericPlaces: ['住处', '工作地点'],
            specificPlaces: [],
        },
        activityPalette: {
            stable: ['处理工作'],
            occasional: ['读书'],
            lowFrequencyTexture: ['咖啡'],
            avoidAsCore: [],
        },
        relationshipToUser: { contactStyle: '温和克制。' },
        variationPolicy: { stableAnchors: ['工作日'] },
        uncertainties: [{ topic: '通勤', detail: '具体路线未确认。' }],
        evidence: [{ id: 'E1', quote: '已经工作', supports: '生活底色与工作相关。' }],
    },
};

describe('CharacterLifeProfileCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedBuildLifeProfileContextSnapshot.mockResolvedValue({
            charId: 'char-1',
            charName: 'Sully',
            charSystemPrompt: '角色人设',
            charPersonality: '城市里的温柔角色',
            moodState: null,
            updatedAt: 1,
        });
    });

    it('shows the missing state and organize button', async () => {
        mockedFetchAgentLifeProfile.mockResolvedValue({ status: 'missing' });

        render(<CharacterLifeProfileCard character={character} userName="Tester" addToast={addToast} />);

        expect(await screen.findByText('还没有整理过。点下面的按钮后，会生成一份可展开验收的角色生活档案。')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /整理生活档案/ })).toBeEnabled();
    });

    it('disables the button while generating and then shows the profile', async () => {
        mockedFetchAgentLifeProfile.mockResolvedValue({ status: 'missing' });
        mockedGenerateAgentLifeProfile.mockResolvedValue(readyState);

        render(<CharacterLifeProfileCard character={character} userName="Tester" addToast={addToast} />);

        fireEvent.click(await screen.findByRole('button', { name: /整理生活档案/ }));

        expect(screen.getByRole('button', { name: /整理中/ })).toBeDisabled();
        expect(await screen.findByText('她的生活以稳定工作和安静休息为底色。')).toBeInTheDocument();
        expect(screen.getByText('低频纹理：咖啡')).toBeInTheDocument();
        expect(addToast).toHaveBeenCalledWith('生活档案已整理好', 'success');
    });

    it('shows failed state and keeps retry available', async () => {
        mockedFetchAgentLifeProfile.mockResolvedValue({
            status: 'failed',
            errorMessage: '模型没有返回可解析的 JSON',
            updatedAt: 1,
        });

        render(<CharacterLifeProfileCard character={character} userName="Tester" addToast={addToast} />);

        expect(await screen.findByText('模型没有返回可解析的 JSON')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /整理生活档案/ })).toBeEnabled();
    });

    it('passes the secondary API config when regenerating', async () => {
        mockedFetchAgentLifeProfile.mockResolvedValue({ status: 'missing' });
        mockedGenerateAgentLifeProfile.mockResolvedValue(readyState);

        render(<CharacterLifeProfileCard character={character} userName="Tester" addToast={addToast} />);

        fireEvent.click(await screen.findByRole('button', { name: /整理生活档案/ }));

        await waitFor(() => expect(mockedGenerateAgentLifeProfile).toHaveBeenCalledTimes(1));
        expect(mockedGenerateAgentLifeProfile).toHaveBeenCalledWith(
            'char-1',
            expect.objectContaining({ charName: 'Sully' }),
            {
                baseUrl: 'https://llm.example.com',
                apiKey: 'sub-key',
                model: 'profile-model',
            },
        );
    });
});
