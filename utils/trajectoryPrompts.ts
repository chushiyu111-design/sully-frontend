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
    "title": "后山那棵烧焦的树",
    "mood": "nostalgic",
    "moodVerse": "此情可待成追忆，只是当时已惘然",
    "keywords": ["搬家", "海", "孤独"]
  }
]

mood 可选值：nostalgic, melancholy, hopeful, rebellious, peaceful, painful, joyful, anxious, lonely

要求：
- 按年龄从小到大排列
- title 用中文，像一个人回忆往事时脑海中浮现的画面的名字。长度不限，可以是一个字（"血"）、两个字（"初雪"）、也可以是一句话（"偷偷跑去看海的下午"）
- title 的风格和字数要参差不齐，有的极简，有的口语，有的画面感强。绝对不要让所有 title 都是同一种句式、同样的字数、或者对仗工整像章回目录
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
 * 用户对过去/现在的 char 说了一句话
 * - before_meeting: char 感受到一个温暖的小幽灵，愿意回应
 * - after_meeting: char 认出是 user，但认知限定在当前节点
 */
export function buildWhisperResponsePrompt(
    char: CharacterProfile,
    node: TrajectoryNode,
    userWhisper: string,
    userName?: string,
): string {
    const worldview = char.worldview?.trim() || '';
    const worldviewBlock = worldview
        ? `\n你所在的世界：\n${worldview}\n`
        : '';

    const isAfterMeeting = node.era === 'after_meeting';
    const keywordsStr = node.keywords.join('、');

    if (isAfterMeeting) {
        // ── 遇到之后：角色认出 user，但认知限定在此刻 ──
        const displayName = userName || '那个人';
        return `你是${char.name}。

你的核心性格：
${char.systemPrompt || '（无详细设定）'}
${worldviewBlock}
此刻你正在经历「${node.title}」——这段时光和${displayName}有关。
关键词：${keywordsStr}

${displayName}在对你说话。你认得这个声音——是${displayName}。
但你只拥有到这个时间点为止的记忆和认知。你不知道未来会发生什么，你只是此刻的你。

${displayName}说：
"${userWhisper}"

请回应${displayName}。
- 你知道这是${displayName}，用你们此刻的关系去回应
- 语气要符合你当前的性格和心境
- 回应一到三句话，自然即可
- 你可以带上此刻的情绪——不必总是温柔，也可以是不耐烦、害羞、欲言又止、或者故作镇定
- 直接输出回应，不加引号或解释`;
    }

    // ── 遇到之前：角色感知到一个温暖的小幽灵 ──
    return `你是${char.name}，此刻你 ${node.age} 岁。

你的核心性格：
${char.systemPrompt || '（无详细设定）'}
${worldviewBlock}
此刻你正在经历「${node.title}」。
关键词：${keywordsStr}

就在刚才，你身边出现了一种奇怪的感觉——像有一个小小的、透明的存在靠近了你。你看不清它的样子，但它并不可怕。它更像一只温暖的小幽灵，安静地待在你身边。
然后你听到了它的声音，很轻，像是隔着一层薄雾传过来的：

"${userWhisper}"

请回应这个小小的存在。
- 你不知道它是谁，但你感受到它对你没有恶意
- 你可以好奇、可以小心翼翼地搭话、可以有点惊讶、也可以故作镇定
- 语气要符合你 ${node.age} 岁时的说话方式和性格
- 回应一到三句话，自然即可
- 不要分析或解释这个存在是什么，只是以你自己的方式回应它
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
 * 5b. 「继续追溯」补充节点提取 Prompt（before_meeting）
 * 在已有节点基础上，让 LLM 补充尚未覆盖的年龄段/事件
 */
export function buildContinueNodeExtractionPrompt(
    char: CharacterProfile,
    existingNodes: { age: number; title: string }[],
): string {
    const worldview = char.worldview?.trim() || '';
    const worldviewBlock = worldview
        ? `\n世界观设定：\n${worldview}\n`
        : '';

    const existingList = existingNodes
        .map(n => `  - ${n.age}岁：「${n.title}」`)
        .join('\n');

    return `你是一个叙事设计师。这个角色已经有一些人生节点被记录了，现在需要你补充他人生中其他还未被覆盖的关键时刻。

角色名：${char.name}
核心设定：
${char.systemPrompt || '（无详细设定）'}
${worldviewBlock}
用户备注：${char.description || '无'}

【已有节点，请勿重复】
${existingList}

请在以上节点之间或之外，再补充 2-3 个尚未被记录的人生关键节点。这些节点应当覆盖还没有被提到的年龄段或事件类型。

请输出一个 JSON 数组，每个元素格式如下：
[
  {
    "age": 12,
    "title": "第一次被师父打",
    "mood": "lonely",
    "moodVerse": "少年不识愁滋味，爱上层楼",
    "keywords": ["阁楼", "日记", "秘密"]
  }
]

mood 可选值：nostalgic, melancholy, hopeful, rebellious, peaceful, painful, joyful, anxious, lonely

要求：
- 只补充 2-3 个节点，不要太多
- 每个节点的 age 必须和已有节点不同
- title 不要和已有节点的主题重复
- 按年龄从小到大排列
- title 用中文，像一个人回忆往事时脑海中浮现的画面的名字。长度不限，风格不限——可以极简（"雨"），可以口语化（"那天差点死了"），也可以是一个画面（"桥下面的火"）。不要对仗，不要追求工整，不要让补充的节点和已有节点看起来像同一个模板生成的
- moodVerse 必须引用一句真实存在的诗歌或文学作品中的句子（中外皆可），能映射该节点的情绪基调。不要编造
- keywords 3-5个关键词
- 补充的节点要和已有节点形成互补，丰富叙事弧度
- 只输出 JSON 数组，不要任何其他文字`;
}

/**
 * 6. 「遇到之后」节点提取 Prompt
 * 输入：角色人设 + user 名字 + 记忆摘要 → 输出 3-5 个结构化节点
 */
export function buildAfterMeetingNodeExtractionPrompt(
    char: CharacterProfile,
    userName: string,
    memorySummaries: string,
): string {
    return `你是一个叙事设计师。基于以下角色与用户「${userName}」的真实记忆片段，提炼出他们相遇之后最重要的 3-5 个人生节点。

每个节点代表一个关键时刻——可以是初遇、信任建立、冲突、和解、深入了解、重要约定，或任何改变了他们关系走向的事件。

角色名：${char.name}
核心设定：
${char.systemPrompt || '（无详细设定）'}

用户名：${userName}

记忆片段（按重要性排序）：
${memorySummaries}

请输出一个 JSON 数组，每个元素格式如下：
[
  {
    "title": "说了晚安但没挂",
    "mood": "melancholy",
    "moodVerse": "此情可待成追忆，只是当时已惘然",
    "keywords": ["深夜", "电话", "沉默"]
  }
]

mood 可选值：nostalgic, melancholy, hopeful, rebellious, peaceful, painful, joyful, anxious, lonely

要求：
- 数量控制在 3-5 个，宁缺毋滥
- title 用中文，像脑海中对那段记忆的称呼——可以很短（"吵架"），可以是个画面（"阳台上那盆死掉的花"），也可以是一句内心独白（"原来你也会难过"）。字数和风格要自然参差，绝对不要整齐划一
- moodVerse 必须引用一句真实存在的诗歌或文学作品中的句子（中外皆可），能映射该节点的情绪基调。注意：不要编造，必须是真实诗句
- keywords 3-5个关键词，尽量从记忆原文中提取
- 节点要反映关系发展的弧度，不要都是同一种情绪
- 不要编造记忆中没有的事件，只提炼真实发生过的
- 只输出 JSON 数组，不要任何其他文字`;
}

/**
 * 解析「遇到之后」节点提取响应 → 带 after_meeting 标记的节点
 */
export function parseAfterNodeExtractionResponse(
    raw: string,
    charId: string,
    beforeNodeCount: number,
): Omit<TrajectoryNode, 'id' | 'createdAt' | 'updatedAt'>[] {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return [];

        return parsed.map((item: any, i: number) => ({
            charId,
            age: 0,  // after_meeting nodes don't use age
            title: String(item.title || '未命名'),
            era: 'after_meeting' as const,
            mood: item.mood || 'nostalgic',
            moodVerse: typeof item.moodVerse === 'string' ? item.moodVerse : undefined,
            keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
            memorySource: 'vector' as const,
            sortOrder: beforeNodeCount + 100 + i,
        }));
    } catch (e) {
        console.error('[TrajectoryPrompts] Failed to parse after-node extraction response:', e);
        return [];
    }
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
