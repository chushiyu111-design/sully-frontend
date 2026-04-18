import type { InputHTMLAttributes } from 'react';

export type GuardedInputKind = 'url' | 'secret' | 'config';

export type GuardedInputProps = InputHTMLAttributes<HTMLInputElement> &
    Record<`data-${string}`, string>;

interface GuardedInputOptions {
    kind: GuardedInputKind;
    field: string;
    inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
    autoComplete?: string;
    enterKeyHint?: InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
}

const PASSWORD_MANAGER_IGNORE_ATTRS = {
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
    'data-lpignore': 'true',
} as const;

function sanitizeFieldName(field: string): string {
    const normalized = field.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'field';
}

export function getGuardedInputProps({
    kind,
    field,
    inputMode,
    autoComplete,
    enterKeyHint,
}: GuardedInputOptions): GuardedInputProps {
    const safeField = sanitizeFieldName(field);
    const commonProps: GuardedInputProps = {
        ...PASSWORD_MANAGER_IGNORE_ATTRS,
        'aria-autocomplete': 'none',
        autoCapitalize: 'none',
        autoCorrect: 'off',
        spellCheck: false,
    };

    if (kind === 'secret') {
        return {
            ...commonProps,
            autoComplete: autoComplete ?? 'new-password',
            enterKeyHint: enterKeyHint ?? 'done',
            inputMode: inputMode ?? 'text',
            name: `credential-${safeField}`,
        };
    }

    if (kind === 'config') {
        return {
            ...commonProps,
            autoComplete: autoComplete ?? 'off',
            enterKeyHint: enterKeyHint ?? 'done',
            inputMode: inputMode ?? 'text',
            name: `config-${safeField}`,
        };
    }

    return {
        ...commonProps,
        autoComplete: autoComplete ?? 'off',
        enterKeyHint: enterKeyHint ?? 'go',
        inputMode: inputMode ?? 'url',
        name: `endpoint-${safeField}`,
    };
}
