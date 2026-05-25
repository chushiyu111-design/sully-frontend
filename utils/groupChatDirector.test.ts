import { describe,expect,it } from 'vitest';
import {
    getGroupDirectorActionContent,
    normalizeGroupProfiles,
    parseGroupDirectorActions,
    resolveGroupDirectorMemberId,
} from './groupChatDirector';
import type { CharacterProfile,GroupProfile } from '../types';

const characters = [
    {
        id: 'char-a',
        charInstanceId: 'chinst_a',
        name: '于生',
        avatar: '',
        description: '',
        systemPrompt: '',
        memories: [],
    },
    {
        id: 'char-b',
        name: '小满',
        avatar: '',
        description: '',
        systemPrompt: '',
        memories: [],
    },
] as CharacterProfile[];

const legacyGroup: GroupProfile = {
    id: 'group-1',
    name: '测试群',
    members: ['chinst_a', 'char-b'],
    createdAt: 1,
};

describe('groupChatDirector helpers', () => {
    it('normalizes legacy chinst group members to canonical character ids', () => {
        const result = normalizeGroupProfiles([legacyGroup], characters);

        expect(result.groups[0].members).toEqual(['char-a', 'char-b']);
        expect(result.changedGroups).toHaveLength(1);
    });

    it('resolves director speakers by name, canonical id, and legacy instance id', () => {
        expect(resolveGroupDirectorMemberId({ charId: '于生', content: '来了' }, legacyGroup, characters)).toBe('char-a');
        expect(resolveGroupDirectorMemberId({ speaker: 'chinst_a', content: '旧 id 也能说话' }, legacyGroup, characters)).toBe('char-a');
        expect(resolveGroupDirectorMemberId({ characterId: 'char-b', content: '我也在' }, legacyGroup, characters)).toBe('char-b');
    });

    it('parses common wrapped director JSON responses', () => {
        const actions = parseGroupDirectorActions(`
<think>先想一想</think>
\`\`\`json
{"messages":[{"speaker":"于生","message":"第一句"}]}
\`\`\`
`);

        expect(actions).toHaveLength(1);
        expect(getGroupDirectorActionContent(actions[0])).toBe('第一句');
    });
});
