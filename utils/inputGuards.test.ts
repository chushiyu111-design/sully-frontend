import { describe,expect,it } from 'vitest';
import { getGuardedInputProps } from './inputGuards';

describe('getGuardedInputProps', () => {
    it('returns url guard props with autofill suppression attrs', () => {
        const props = getGuardedInputProps({
            kind: 'url',
            field: 'Primary API URL',
        });

        expect(props.autoComplete).toBe('off');
        expect(props.inputMode).toBe('url');
        expect(props.enterKeyHint).toBe('go');
        expect(props.name).toBe('endpoint-primary-api-url');
        expect(props.autoCorrect).toBe('off');
        expect(props.autoCapitalize).toBe('none');
        expect(props.spellCheck).toBe(false);
        expect(props['aria-autocomplete']).toBe('none');
        expect(props['data-1p-ignore']).toBe('true');
        expect(props['data-bwignore']).toBe('true');
        expect(props['data-form-type']).toBe('other');
        expect(props['data-lpignore']).toBe('true');
    });

    it('returns secret guard props with password-manager ignore attrs', () => {
        const props = getGuardedInputProps({
            kind: 'secret',
            field: 'Primary API Key',
        });

        expect(props.autoComplete).toBe('new-password');
        expect(props.inputMode).toBe('text');
        expect(props.enterKeyHint).toBe('done');
        expect(props.name).toBe('credential-primary-api-key');
        expect(props.autoCorrect).toBe('off');
        expect(props.autoCapitalize).toBe('none');
        expect(props.spellCheck).toBe(false);
        expect(props['aria-autocomplete']).toBe('none');
        expect(props['data-1p-ignore']).toBe('true');
        expect(props['data-bwignore']).toBe('true');
        expect(props['data-form-type']).toBe('other');
        expect(props['data-lpignore']).toBe('true');
    });
});
