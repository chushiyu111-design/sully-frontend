// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CharacterWeixinBindingCard from './CharacterWeixinBindingCard';

const {
    mockCheckWeixinQrStatus,
    mockGenerateWeixinQr,
    mockListWeixinBindings,
} = vi.hoisted(() => ({
    mockCheckWeixinQrStatus: vi.fn(),
    mockGenerateWeixinQr: vi.fn(),
    mockListWeixinBindings: vi.fn(),
}));

vi.mock('../../utils/backendClient', async () => {
    const actual = await vi.importActual<typeof import('../../utils/backendClient')>('../../utils/backendClient');
    return {
        ...actual,
        checkWeixinQrStatus: mockCheckWeixinQrStatus,
        generateWeixinQr: mockGenerateWeixinQr,
        listWeixinBindings: mockListWeixinBindings,
    };
});

const mockAddToast = vi.fn();

describe('CharacterWeixinBindingCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the active binding state for the current character', async () => {
        mockListWeixinBindings.mockResolvedValue([
            {
                id: 1,
                userId: 'user-1',
                charId: 'char-1',
                weixinBotName: null,
                bridgeSessionId: null,
                status: 'active',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ]);

        render(
            <CharacterWeixinBindingCard
                charId="char-1"
                charName="Sully"
                addToast={mockAddToast}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('真实微信已连接')).toBeInTheDocument();
        expect(screen.getByText('已连接')).toBeInTheDocument();
        expect(mockListWeixinBindings).toHaveBeenCalledTimes(1);
    });

    it('generates a QR code and marks the flow successful after confirmation polling', async () => {
        vi.useFakeTimers();
        mockListWeixinBindings
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 2,
                    userId: 'user-1',
                    charId: 'char-1',
                    weixinBotName: null,
                    bridgeSessionId: null,
                    status: 'active',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            ]);
        mockGenerateWeixinQr.mockResolvedValue({
            qrcode: 'qr-123',
            qrcodeImgUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=qr-123&bot_type=3',
        });
        mockCheckWeixinQrStatus.mockResolvedValue({
            status: 'confirmed',
        });

        render(
            <CharacterWeixinBindingCard
                charId="char-1"
                charName="Sully"
                addToast={mockAddToast}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('还没绑定真实微信')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '打开扫码' }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByAltText('微信扫码二维码')).toHaveAttribute(
            'src',
            expect.stringContaining('quickchart.io/qr?text='),
        );
        expect(mockGenerateWeixinQr).toHaveBeenCalledWith('char-1', 'Sully');

        await act(async () => {
            vi.advanceTimersByTime(1600);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mockCheckWeixinQrStatus).toHaveBeenCalledWith('qr-123');
        expect(screen.getByText('绑定完成，这个角色已经接上真实微信。')).toBeInTheDocument();
        expect(mockListWeixinBindings).toHaveBeenCalledTimes(2);
        expect(mockAddToast).toHaveBeenCalledWith(
            '微信绑定成功，现在可以在 staging 里继续测试了',
            'success',
        );
    });
});
