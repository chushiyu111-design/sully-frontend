import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageItem from '../components/chat/MessageItem';
import type { Message } from '../types';

vi.mock('../utils/haptics', () => ({
    haptic: {
        heavy: vi.fn(),
    },
}));

vi.mock('../components/chat/ThemeRegistry', () => ({
    THEME_PLUGINS: {},
}));

vi.mock('../components/chat/StatusCardRenderer', () => ({
    default: () => null,
}));

const baseTheme = {
    id: 'default',
    type: 'preset',
    user: {},
    ai: {},
} as any;

function renderMessage(msg: Message) {
    return render(
        <MessageItem
            msg={msg}
            isFirstInGroup
            isLastInGroup
            activeTheme={baseTheme}
            charAvatar="/char.png"
            charName="夏以昼"
            userAvatar="/user.png"
            onLongPress={vi.fn()}
            selectionMode={false}
            isSelected={false}
            onToggleSelect={vi.fn()}
            onPlayVoice={vi.fn()}
            onStopVoice={vi.fn()}
            onRetryVoice={vi.fn()}
            onToggleVoiceText={vi.fn()}
        />,
    );
}

describe('MessageItem voice reply preview', () => {
    it('shows voice reply metadata above assistant voice bubbles', () => {
        renderMessage({
            id: 12,
            charId: 'char-1',
            role: 'assistant',
            type: 'voice',
            content: '好好睡。',
            timestamp: 1,
            metadata: { duration: 4, sourceText: '好好睡。', hasAudio: false },
            replyTo: {
                id: 7,
                name: '雪梨',
                content: '晚安，雪梨。我守着你。',
                type: 'voice',
                duration: 6,
            },
        });

        expect(screen.getByText('雪梨 · 语音')).toBeInTheDocument();
        expect(screen.getByText('"晚安，雪梨。我守着你。"')).toBeInTheDocument();
    });
});
