/**
 * Trajectory Engine — 人生轨迹 核心逻辑
 * LLM 调用、节点生成、独白生成、窃语回应
 */

import type { CharacterProfile } from '../types';
import type { TrajectoryNode, TrajectoryMood } from '../types/trajectory';
import { buildNodeExtractionPrompt, buildMonologuePrompt, buildWhisperResponsePrompt, buildAfterMeetingMonologuePrompt, parseNodeExtractionResponse } from './trajectoryPrompts';
import { safeResponseJson } from './safeApi';
import { extractThinking } from './thinkingExtractor';
import { saveAllTrajectoryNodes, saveTrajectoryNode, saveTrajectoryMeta } from './db/trajectoryStore';
import { DB } from './db';

interface ApiConfig { baseUrl: string; apiKey: string; model: string; }

/** Fallback UUID for non-secure contexts (HTTP) where crypto.randomUUID is unavailable */
function safeUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

async function callLLM(api: ApiConfig, system: string, user: string, temp = 0.8): Promise<string> {
    const res = await fetch(`${api.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.apiKey}` },
        body: JSON.stringify({
            model: api.model,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: temp,
        }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await safeResponseJson(res);
    return extractThinking(data.choices?.[0]?.message?.content || '').content.trim();
}

/** Check if character has at least 1 message (admission gate) */
export async function hasAnyMessages(charId: string): Promise<boolean> {
    const result = await DB.getRecentMessagesWithCount(charId, 1);
    return result.messages.length > 0;
}

/** Get the timestamp of the first message (meeting point) */
export async function getFirstMessageTimestamp(charId: string): Promise<number | undefined> {
    const msgs = await DB.getMessagesByCharId(charId);
    const sorted = msgs.filter(m => m.role === 'user' || m.role === 'assistant').sort((a, b) => a.timestamp - b.timestamp);
    return sorted[0]?.timestamp;
}

/** Generate "before meeting" nodes from character profile */
export async function generateBeforeNodes(char: CharacterProfile, api: ApiConfig): Promise<TrajectoryNode[]> {
    const prompt = buildNodeExtractionPrompt(char);
    const raw = await callLLM(api, '你是叙事设计师。只输出JSON数组，不要其他文字。', prompt, 0.7);
    const parsed = parseNodeExtractionResponse(raw, char.id);
    const now = Date.now();
    return parsed.map((p, i) => ({
        ...p,
        id: safeUUID(),
        createdAt: now,
        updatedAt: now,
        sortOrder: i,
    }));
}

/** Generate monologue for a "before meeting" node */
export async function generateMonologue(char: CharacterProfile, node: TrajectoryNode, api: ApiConfig): Promise<string> {
    const prompt = buildMonologuePrompt(char, node);
    return callLLM(api, '你是角色扮演AI。直接输出独白正文。', prompt, 0.85);
}

/** Generate monologue for an "after meeting" node */
export async function generateAfterMonologue(
    char: CharacterProfile, node: TrajectoryNode, userName: string, api: ApiConfig,
): Promise<string> {
    let memories = '';
    if (node.memorySource === 'vector' && node.memoryTimeRange) {
        try {
            const headers = await DB.getVectorMemoryHeaders(char.id);
            const inRange = headers.filter((h: any) =>
                h.createdAt >= node.memoryTimeRange!.start && h.createdAt <= node.memoryTimeRange!.end
            ).sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0)).slice(0, 5);
            if (inRange.length > 0) {
                const full = await DB.getVectorMemoriesByIds(inRange.map((h: any) => h.id));
                memories = full.map((m: any) => m.content || m.summary || '').filter(Boolean).join('\n---\n');
            }
        } catch (e) { console.warn('[Trajectory] vector memory retrieval failed:', e); }
    }
    const prompt = buildAfterMeetingMonologuePrompt(char, node, userName, memories);
    return callLLM(api, '你是角色扮演AI。直接输出独白正文。', prompt, 0.85);
}

/** Generate whisper response */
export async function generateWhisperResponse(
    char: CharacterProfile, node: TrajectoryNode, whisper: string, api: ApiConfig,
): Promise<string> {
    const prompt = buildWhisperResponsePrompt(char, node, whisper);
    return callLLM(api, '你是角色扮演AI。直接输出回应，不加引号。', prompt, 0.8);
}

/** Initialize trajectory for a character (first visit) */
export async function initTrajectory(char: CharacterProfile, api: ApiConfig): Promise<TrajectoryNode[]> {
    const nodes = await generateBeforeNodes(char, api);
    saveAllTrajectoryNodes(char.id, nodes);
    const meetTs = await getFirstMessageTimestamp(char.id);
    saveTrajectoryMeta({
        charId: char.id,
        lastGeneratedAt: Date.now(),
        meetingPointTimestamp: meetTs,
        totalNodes: nodes.length,
    });
    return nodes;
}

/** Create a manual "after meeting" node */
export function createManualAfterNode(
    charId: string, title: string, keywords: string, existingCount: number,
): TrajectoryNode {
    const now = Date.now();
    const node: TrajectoryNode = {
        id: safeUUID(),
        charId,
        age: 0,
        title,
        era: 'after_meeting',
        mood: 'nostalgic' as TrajectoryMood,
        keywords: keywords.split(/[,，、\s]+/).filter(Boolean),
        memorySource: 'manual',
        memoryKeywords: keywords,
        sortOrder: existingCount + 100,
        createdAt: now,
        updatedAt: now,
    };
    saveTrajectoryNode(node);
    return node;
}
