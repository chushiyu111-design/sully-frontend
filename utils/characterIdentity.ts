import type { CharacterProfile } from '../types';

export const CHAR_INSTANCE_PREFIX = 'chinst_';

function fallbackUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const rand = Math.random() * 16 | 0;
        const value = char === 'x' ? rand : (rand & 0x3 | 0x8);
        return value.toString(16);
    });
}

export function generateCharInstanceId(): string {
    const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : fallbackUuid();
    return `${CHAR_INSTANCE_PREFIX}${uuid}`;
}

export function getCharacterTemplateId(char: Pick<CharacterProfile, 'id' | 'templateCharId'>): string {
    return (char.templateCharId || char.id).trim();
}

export function getCharacterContentId(char: Pick<CharacterProfile, 'id' | 'charInstanceId'>): string {
    return (char.charInstanceId || char.id).trim();
}

export function ensureCharacterInstanceId(character: CharacterProfile): CharacterProfile {
    const existing = typeof character.charInstanceId === 'string'
        ? character.charInstanceId.trim()
        : '';
    if (existing) {
        return {
            ...character,
            charInstanceId: existing,
            templateCharId: character.templateCharId || character.id,
        };
    }

    return {
        ...character,
        templateCharId: character.templateCharId || character.id,
        charInstanceId: generateCharInstanceId(),
    };
}
