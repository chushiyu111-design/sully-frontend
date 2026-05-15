import type { CharacterProfile, VectorMemory } from '../types';
import { DB } from './db';
import { pullMemories } from './backendClient';
import { buildCoreMemoryDigest, buildMountedWorldbooksDigest } from './agentContextSnapshot';

type MemorySummary = Pick<
    VectorMemory,
    'title' | 'content' | 'importance' | 'createdAt' | 'deprecated' | 'salienceScore'
>;

export type LifeProfileContextSnapshot = {
    charId: string;
    charName: string;
    charSystemPrompt: string;
    charPersonality: string;
    worldview?: string;
    mountedWorldbooksDigest?: string;
    coreMemoryDigest?: string;
    cityOverride?: string;
    cityAdcode?: string;
    isFictionalCity?: boolean;
    cityReferenceReal?: string;
    moodState: Record<string, unknown> | null;
    topMemory?: string;
    userName?: string;
    updatedAt: number;
};

function pickTopMemory(memories: MemorySummary[]): MemorySummary | undefined {
    return memories
        .filter(memory => !memory.deprecated)
        .sort((left, right) => {
            const salienceDiff = (right.salienceScore || 0) - (left.salienceScore || 0);
            if (salienceDiff !== 0) return salienceDiff;

            const importanceDiff = (right.importance || 0) - (left.importance || 0);
            if (importanceDiff !== 0) return importanceDiff;

            return (right.createdAt || 0) - (left.createdAt || 0);
        })[0];
}

function formatTopMemory(memory?: MemorySummary): string | undefined {
    if (!memory) return undefined;
    return `${memory.title || 'Memory'}: ${(memory.content || '').slice(0, 120)}`;
}

async function loadTopMemorySummary(charId: string): Promise<string | undefined> {
    try {
        const cloudMemories = await pullMemories(charId);
        const topCloudMemory = pickTopMemory((cloudMemories || []) as MemorySummary[]);
        if (topCloudMemory) return formatTopMemory(topCloudMemory);
    } catch {
        // Fall through to local cache.
    }

    try {
        const localHeaders = await DB.getVectorMemoryHeaders(charId);
        return formatTopMemory(pickTopMemory(localHeaders as MemorySummary[]));
    } catch {
        return undefined;
    }
}

export async function buildLifeProfileContextSnapshot(
    char: CharacterProfile,
    userName?: string,
): Promise<LifeProfileContextSnapshot> {
    const topMemory = await loadTopMemorySummary(char.id);
    const isFictionalCity = char.isFictionalCity || undefined;

    return {
        charId: char.id,
        charName: char.name,
        charSystemPrompt: (char.systemPrompt || '').slice(0, 3000),
        charPersonality: (char.description || '').slice(0, 600),
        worldview: (char.worldview || '').slice(0, 1800) || undefined,
        mountedWorldbooksDigest: buildMountedWorldbooksDigest(char.mountedWorldbooks),
        coreMemoryDigest: buildCoreMemoryDigest(char, topMemory, { maxLength: 2200 }),
        cityOverride: char.cityOverride?.trim() || undefined,
        cityAdcode: char.cityAdcode?.trim() || undefined,
        isFictionalCity,
        cityReferenceReal: isFictionalCity ? (char.cityReferenceReal?.trim() || undefined) : undefined,
        moodState: (char.moodState as unknown as Record<string, unknown> | undefined) || null,
        topMemory,
        userName,
        updatedAt: Date.now(),
    };
}
