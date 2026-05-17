import type { CharacterProfile } from '../types';
import { buildCoreMemoryDigest, buildMountedWorldbooksDigest } from './agentContextSnapshot';

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
    userName?: string;
    updatedAt: number;
};

export async function buildLifeProfileContextSnapshot(
    char: CharacterProfile,
    userName?: string,
): Promise<LifeProfileContextSnapshot> {
    const isFictionalCity = char.isFictionalCity || undefined;

    return {
        charId: char.id,
        charName: char.name,
        charSystemPrompt: char.systemPrompt || '',
        charPersonality: char.description || '',
        worldview: char.worldview || undefined,
        mountedWorldbooksDigest: buildMountedWorldbooksDigest(char.mountedWorldbooks),
        coreMemoryDigest: buildCoreMemoryDigest(char, undefined, { maxLength: 2200 }),
        cityOverride: char.cityOverride?.trim() || undefined,
        cityAdcode: char.cityAdcode?.trim() || undefined,
        isFictionalCity,
        cityReferenceReal: isFictionalCity ? (char.cityReferenceReal?.trim() || undefined) : undefined,
        moodState: (char.moodState as unknown as Record<string, unknown> | undefined) || null,
        userName,
        updatedAt: Date.now(),
    };
}
