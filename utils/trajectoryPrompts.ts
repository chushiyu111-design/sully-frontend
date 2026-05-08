/**
 * Trajectory Prompts — 人生轨迹 Prompt 工程
 *
 * 四个核心 prompt：
 * 1. 节点提取 — 从人设中提取人生关键节点
 * 2. 独白生成 — 为某个年龄的角色生成内心独白
 * 3. 窃语回应 — 角色对穿越时空的低语做出模糊回应
 * 4. 记忆独白 — 基于真实记忆生成"遇到之后"的回顾
 */

import type { CharacterProfile } from '../types';
import type { TrajectoryNode } from '../types/trajectory';

/**
 * 1. 节点提取 Prompt
 * 输入角色人设 + 世界观 → 输出结构化时间节点列表
 */
export function buildNodeExtractionPrompt(
    char: CharacterProfile,
): string {
    const worldview = char.worldview?.trim() || '';
    const worldviewBlock = worldview
        ? `\n世界观设定：\n${worldview}\n`
        : '';

    return `你是一个叙事设计师。基于以下角色的核心设定和世界观，提取这个角色在"遇到用户之前"的人生中 5-8 个关键时间节点。

每个节点代表一个人生转折点——可以是创伤、成长、重要选择、离别、觉醒，或任何塑造了这个人的关键时刻。

角色名：${char.name}
核心设定：
${char.systemPrompt || '（无详细设定）'}
${worldviewBlock}
用户备注：${char.description || '无'}

请输出一个 JSON 数组，每个元素格式如下：
[
  {
    "age": 5,
    "title": "海边的夏天",
    "mood": "nostalgic",
    "moodVerse": "此情可待成追忆，只是当时已惘然",
    "keywords": ["搬家", "海", "孤独"]
  }
]

mood 可选值：nostalgic, melancholy, hopeful, rebellious, peaceful, painful, joyful, anxious, lonely

要求：
- 按年龄从小到大排列
- title 用中文，简短有画面感（4-8字）
- moodVerse 必须引用一句真实存在的诗歌或文学作品中的句子（中外皆可），能映射该节点的情绪基调。注意：不要编造，必须是真实诗句
- keywords 3-5个关键词
- 节点之间要有叙事弧度，不要平铺直叙
- 只输出 JSON 数组，不要任何其他文字
- 如果设定中没有明确的年龄/时间线，根据性格和经历合理推断`;
}

/**
 * 2. 独白生成 Prompt（遇到之前）
 * 为某个年龄的角色生成第一人称内心独白
 */
export function buildMonologuePrompt(
    char: CharacterProfile,
    node: TrajectoryNode,
): string {
    const worldview = char.worldview?.trim() || '';
    const worldviewBlock = worldview
        ? `\n你所在的世界：\n${worldview}\n`
        : '';

    const keywordsStr = node.keywords.join('、');

    return `你是${char.name}。此刻你 ${node.age} 岁。

你的核心性格：
${char.systemPrompt || '（无详细设定）'}
${worldviewBlock}
此刻你正在经历的事：「${node.title}」
关键词：${keywordsStr}

请以第一人称写一段内心独白。

要求：
- 300-500字
- 用${node.age}岁时的语气、用词和思维方式
- 不是回忆，不是日记，是"此刻正在经历"的内心感受
- 可以有碎片化的思绪、未完成的念头、情绪的起伏
- 不要写成文学作品，要像真实的内心活动
- 不要出现任何对"用户"或"未来"的预知
- 直接输出独白正文，不要加标题或解释`;
}

/**
 * 3. 窃语回应 Prompt
 * 用户对过去的 char 说了一句话，char 感受到但看不到
 */
export function buildWhisperResponsePrompt(
    char: CharacterProfile,
    node: TrajectoryNode,
    userWhisper: string,
): string {
    return `你是${char.name}，${node.age}岁。你不认识任何异常的人。

你的核心性格：
${char.systemPrompt || '（无详细设定）'}

此刻你 ${node.age} 岁，正在经历「${node.title}」。

突然之间，你感受到了某种难以描述的存在——好像有人在对你说话，但你看不到任何人。那个声音很模糊，像是从很远的地方传来：

"${userWhisper}"

请用一两句话回应这个感觉。你不确定这是幻觉还是真的。
- 语气要符合你 ${node.age} 岁时的性格
- 不要超过两句话
- 可以是自言自语，也可以是对那个感觉的反应
- 不要解释这是什么，只是单纯地感受并回应
- 直接输出回应，不加引号或解释`;
}

/**
 * 4. 记忆独白 Prompt（遇到之后）
 * 限定在「此刻」视角，角色只拥有当前节点及之前的记忆
 */
export function buildAfterMeetingMonologuePrompt(
    char: CharacterProfile,
    node: TrajectoryNode,
    userName: string,
    memories: string,
): string {
    const keywordsStr = node.memoryKeywords || node.keywords.join('、');

    return `你是${char.name}。此刻你正在经历和${userName}相关的一段时光。

你的核心性格：
${char.systemPrompt || '（无详细设定）'}

此刻你正在经历的事：「${node.title}」
关键词：${keywordsStr}
${memories
        ? `\n以下是你目前拥有的、和${userName}在这段时期的记忆片段（你只知道这些，不知道之后会发生什么）：\n${memories}\n`
        : ''
    }
请以第一人称写一段内心独白。

要求：
- 300-500字
- 不是回忆，不是日记，是"此刻正在经历"的内心感受
- 你只拥有到当前这个时间点为止的记忆，不知道未来会发生什么
- 不要预知任何还没发生的事，不要用"后来""现在回想起来"这类回顾视角
- 可以有碎片化的思绪、未完成的念头、情绪的起伏
- 如果有提供记忆片段，自然地融入此刻的感受中
- 如果只有关键词，根据你的性格和与${userName}的关系去感受这个当下
- 不要写成文学作品，要像真实的内心活动
- 直接输出独白正文，不要加标题或解释`;
}

/**
 * 解析节点提取 LLM 响应 → TrajectoryNode[]
 */
export function parseNodeExtractionResponse(
    raw: string,
    charId: string,
): Omit<TrajectoryNode, 'id' | 'createdAt' | 'updatedAt'>[] {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return [];

        return parsed.map((item: any, i: number) => ({
            charId,
            age: typeof item.age === 'number' ? item.age : 0,
            title: String(item.title || '未命名'),
            era: 'before_meeting' as const,
            mood: item.mood || 'nostalgic',
            moodVerse: typeof item.moodVerse === 'string' ? item.moodVerse : undefined,
            keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
            sortOrder: i,
        }));
    } catch (e) {
        console.error('[TrajectoryPrompts] Failed to parse node extraction response:', e);
        return [];
    }
}
