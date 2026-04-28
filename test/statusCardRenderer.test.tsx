import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusCardRenderer from '../components/chat/StatusCardRenderer';
import { STATUS_CARD_IFRAME_SHELL } from '../components/chat/statusCardIframe';
import type { StatusCardData } from '../types/statusCard';

describe('StatusCardRenderer', () => {
    it('keeps the freeform iframe shell isolated from origin and network access', () => {
        expect(STATUS_CARD_IFRAME_SHELL).toContain("connect-src 'none'");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("base-uri 'none'");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("form-action 'none'");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("media-src data: blob:");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("defineBlockedValue(window, 'fetch'");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("defineBlockedValue(window, 'XMLHttpRequest'");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("collectAndRemoveScripts");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("node.hasAttribute('src')");
        expect(STATUS_CARD_IFRAME_SHELL).toContain("type === 'text/javascript'");
    });

    it('sizes freeform cards from the reported html width and height', async () => {
        const data: StatusCardData = {
            cardType: 'freeform',
            body: 'Custom card',
            meta: {
                html: '<html><body><div style="height:360px">Marcus</div></body></html>',
            },
            style: {},
        };

        render(<StatusCardRenderer data={data} />);

        const frame = screen.getByTitle('Freeform creative card') as HTMLIFrameElement;
        expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
        expect(frame).toHaveStyle({ height: '1px' });

        fireEvent.load(frame);

        const channel = frame.getAttribute('data-preview-channel');
        expect(channel).toBeTruthy();

        act(() => {
            const messageEvent = new MessageEvent('message', {
                data: { type: 'preview-height', channel, width: 286, height: 360 },
            });
            Object.defineProperty(messageEvent, 'source', { value: frame.contentWindow });
            window.dispatchEvent(messageEvent);
        });

        await waitFor(() => {
            expect(frame).toHaveStyle({ width: '294px' });
            expect(frame).toHaveStyle({ height: '368px' });
        });
    });

    it('passes the allowScripts flag only for opted-in freeform cards', async () => {
        const data: StatusCardData = {
            cardType: 'freeform',
            body: 'Custom card',
            meta: {
                html: '<html><body><button id="toggle">Toggle</button><script>document.body.dataset.ready = "yes";</script></body></html>',
                allowScripts: true,
            },
            style: {},
        };

        render(<StatusCardRenderer data={data} />);

        const frame = screen.getByTitle('Freeform creative card') as HTMLIFrameElement;
        const postMessageSpy = vi.spyOn(frame.contentWindow!, 'postMessage');

        fireEvent.load(frame);

        await waitFor(() => {
            expect(postMessageSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'preview-update',
                    html: data.meta?.html,
                    allowScripts: true,
                }),
                '*',
            );
        });
    });

    it('renders custom text cards with the dedicated non-fallback shell', () => {
        const data: StatusCardData = {
            cardType: 'custom_text',
            title: 'Location',
            body: '中环泰臣大厦顶层，执行总裁办公室',
            footer: 'Marcus',
            style: {},
        };

        render(<StatusCardRenderer data={data} />);

        expect(screen.getByTestId('custom-text-status-card')).toHaveTextContent('Location');
        expect(screen.getByTestId('custom-text-status-card')).toHaveTextContent('中环泰臣大厦顶层');
        expect(screen.queryByText('Inner Voice')).not.toBeInTheDocument();
    });
});
