import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoryPhoneScreen, { PHONE_APPS } from './StoryPhoneScreen';

describe('StoryPhoneScreen home UI', () => {
    it('uses dynamic home copy and keeps the active app dot visible', () => {
        const musicApp = PHONE_APPS.find(app => app.id === 'music') || PHONE_APPS[0];
        const { container } = render(
            <StoryPhoneScreen
                charName="陈步青"
                activeAppId="home"
                spotlightApp={musicApp}
                currentTime="11:50"
                homeSurface={{
                    headline: '刚才的对话还没暗下去。',
                    stickyNote: '「她把伞留在玄关」',
                    spotlightDetail: '音乐会贴着刚才那一幕生成。',
                    spotlightFooter: '最近对话 · 11:50',
                }}
                onGenerateApp={() => undefined}
                onOpenApp={() => undefined}
            />,
        );

        expect(screen.getByText('刚才的对话还没暗下去。')).toBeInTheDocument();
        expect(screen.getByText('「她把伞留在玄关」')).toBeInTheDocument();
        expect(screen.getByText('音乐会贴着刚才那一幕生成。')).toBeInTheDocument();
        expect(screen.getByText('最近对话 · 11:50')).toBeInTheDocument();
        expect(screen.queryByText('记得按时吃饭。')).not.toBeInTheDocument();
        expect(container.innerHTML).not.toContain('d8d2c6');
        expect(container.innerHTML).not.toContain('ded8cb');
        expect(container.innerHTML).not.toContain('-right-0.5 -top-0.5');
        expect(container.innerHTML).toContain('right-0 top-0');
    });
});
