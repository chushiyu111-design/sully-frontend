// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { DB } from '../utils/db';
import { ensureCharacterInstanceId, getCharacterContentId } from '../utils/characterIdentity';
import type { CharacterProfile } from '../types';

function resetIndexedDb() {
    Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
    Object.defineProperty(globalThis, 'IDBKeyRange', { value: IDBKeyRange, configurable: true });
}

function makeCharacter(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
    return {
        id: 'preset-sully-v2',
        name: 'Sully',
        avatar: '',
        description: '',
        systemPrompt: '',
        memories: [],
        ...overrides,
    };
}

describe('character identity', () => {
    beforeEach(() => {
        resetIndexedDb();
        localStorage.clear();
        localStorage.setItem('csyos_user_id', 'csy-user-test');
    });

    it('adds a stable personal instance id while preserving the template id', () => {
        const character = ensureCharacterInstanceId(makeCharacter());

        expect(character.id).toBe('preset-sully-v2');
        expect(character.templateCharId).toBe('preset-sully-v2');
        expect(character.charInstanceId).toMatch(/^chinst_/);
        expect(getCharacterContentId(character)).toBe(character.charInstanceId);
    });

    it('migrates legacy local chat content onto the character instance id without duplicating backend messages', async () => {
        await DB.saveMessage({
            charId: 'preset-sully-v2',
            role: 'assistant',
            type: 'text',
            content: 'old Sully reply',
            metadata: { backendMessageId: 'backend-msg-1' },
        });

        const charInstanceId = 'chinst_test-sully-instance';
        await DB.saveCharacter(makeCharacter({ charInstanceId, templateCharId: 'preset-sully-v2' }));
        const counts = await DB.migrateLocalCharacterContentToInstance('preset-sully-v2', charInstanceId);

        expect(counts.messages).toBe(1);
        const messages = await DB.getMessagesByCharId('preset-sully-v2');
        expect(messages).toHaveLength(1);
        expect(messages[0].charId).toBe(charInstanceId);
        expect(messages[0].ownerUserId).toBe('csy-user-test');

        const deduped = await DB.saveMessageOnceByBackendId({
            charId: 'preset-sully-v2',
            role: 'assistant',
            type: 'text',
            content: 'duplicate from backend',
            metadata: { backendMessageId: 'backend-msg-1' },
        });

        expect(deduped.saved).toBe(false);
        expect(await DB.getMessagesByCharId(charInstanceId)).toHaveLength(1);
    });
});
