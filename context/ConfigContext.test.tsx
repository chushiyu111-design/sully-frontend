// @vitest-environment jsdom

import React from 'react';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { ConfigProvider,useConfig } from './ConfigContext';

const ConfigTestButton: React.FC = () => {
    const { isConfigLoaded,updateApiConfig } = useConfig();

    return (
        <button
            disabled={!isConfigLoaded}
            onClick={() => updateApiConfig({
                apiKey: 'main-key',
                baseUrl: 'https://main.example.com',
                model: 'gpt-main',
            })}
        >
            save api
        </button>
    );
};

describe('ConfigContext', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('notifies the agent runtime after saving primary API config', async () => {
        const listener = vi.fn();
        window.addEventListener('agent-config-changed', listener);

        try {
            render(
                <ConfigProvider>
                    <ConfigTestButton />
                </ConfigProvider>,
            );

            const saveButton = screen.getByRole('button', { name: 'save api' });
            await waitFor(() => expect(saveButton).not.toBeDisabled());

            fireEvent.click(saveButton);

            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('agent-config-changed', listener);
        }
    });
});
