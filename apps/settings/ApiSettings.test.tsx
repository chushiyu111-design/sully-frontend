// @vitest-environment jsdom

import { render,screen } from '@testing-library/react';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import ApiSettings from './ApiSettings';

const {
    addApiPreset,
    addToast,
    removeApiPreset,
    setAvailableModels,
    updateApiConfig,
} = vi.hoisted(() => ({
    addApiPreset: vi.fn(),
    addToast: vi.fn(),
    removeApiPreset: vi.fn(),
    setAvailableModels: vi.fn(),
    updateApiConfig: vi.fn(),
}));

vi.mock('../../context/OSContext', () => ({
    useOS: () => ({
        apiConfig: {
            apiKey: 'seed-key',
            baseUrl: 'https://api.example.com',
            model: 'gpt-4o-mini',
            disablePrefill: false,
        },
        updateApiConfig,
        availableModels: [],
        setAvailableModels,
        apiPresets: [],
        addApiPreset,
        removeApiPreset,
        addToast,
    }),
}));

describe('ApiSettings', () => {
    beforeEach(() => {
        addApiPreset.mockReset();
        addToast.mockReset();
        removeApiPreset.mockReset();
        setAvailableModels.mockReset();
        updateApiConfig.mockReset();
    });

    it('applies guarded props to primary api url and key inputs', () => {
        render(<ApiSettings />);

        const urlInput = screen.getByPlaceholderText('https://...');
        const keyInput = screen.getByPlaceholderText('sk-...');

        expect(urlInput).toHaveAttribute('autocomplete', 'off');
        expect(urlInput).toHaveAttribute('inputmode', 'url');
        expect(urlInput).toHaveAttribute('name', 'endpoint-primary-api-url');
        expect(urlInput).toHaveAttribute('data-lpignore', 'true');
        expect(urlInput).toHaveAttribute('data-1p-ignore', 'true');

        expect(keyInput).toHaveAttribute('type', 'password');
        expect(keyInput).toHaveAttribute('autocomplete', 'new-password');
        expect(keyInput).toHaveAttribute('inputmode', 'text');
        expect(keyInput).toHaveAttribute('name', 'credential-primary-api-key');
        expect(keyInput).toHaveAttribute('data-lpignore', 'true');
        expect(keyInput).toHaveAttribute('data-1p-ignore', 'true');
    });
});
