/**
 * Crosstime Prompts — 跨时空对话 Prompt 引擎
 *
 * 为每个时空切片构建独立的人格上下文，
 * 然后组装导演 prompt 驱动多角色对话。
 */

import type { CharacterProfile, UserProfile } from '../types';
import type { TrajectoryNode } from '../types/trajectory';
import type { CrosstimeParticipant, CrosstimeMessage } from '../types/crosstime';
import { ContextBuilder } from './context';

/**
 * 为单个时空切片构建人格上下文
 */
export function buildParticipantContext(
    participant: CrosstimeParticipant,
    char: CharacterProfile,
    userProfile: UserProfile,
    node?: TrajectoryNode,
): string {
    const pid = participant.id;
    const displayName = `${char.name}·${participant.label}`;

    if (participant.timeSlice === 'current') {
        // 当前版本：完整上下文
        const coreContext = ContextBuilder.buildCoreContext(char, userProfile, true);
        return `<<< 参与者档案 START: ${displayName} (PID: ${pid}) >>>
${coreContext}
[时空标识]: 当前时间线的${char.name}，拥有完整的记忆和经历。
[与用户的关系]: 认识${userProfile.name}。
<<< 参与者档案 END >>>
`;
    }

    // 轨迹节点切片：裁剪版上下文
    let context = `<<< 参与者档案 START: ${displayName} (PID: ${pid}) >>>
### 身份
- 名字: ${char.name}
- 年龄: ${participant.age ?? '未知'}岁
- 核心性格:
${char.systemPrompt || '（未设定）'}

`;

    if (char.worldview?.trim()) {
        context += `### 世界观
${char.worldview}

`;
    }

    if (node) {
        context += `### 时空锚点
- 人生阶段: ${node.title}
- 情绪底色: ${node.mood}
- 关键词: ${node.keywords.join('、')}
`;
        if (node.monologue) {
            context += `- 内心独白片段:
${node.monologue.slice(0, 300)}${node.monologue.length > 300 ? '…' : ''}
`;
        }

        context += `
### ⚠️ 时空隔离规则
- 你是 ${participant.age ?? '?'}岁的${char.name}。你**不知道** ${participant.age ?? '?'}岁以后会发生什么。
- 不要提及任何你这个年龄之后的事件。
`;

        if (participant.era === 'before_meeting') {
            context += `- 你**不认识** ${userProfile.name}。如果他出现，你会好奇他是谁。
`;
        } else {
            context += `- 你认识 ${userProfile.name}（互动对象: ${userProfile.name}，${userProfile.bio || '无备注'}）。
`;
        }
    }

    context += `<<< 参与者档案 END >>>
`;
    return context;
}

/**
 * 检查是否存在同一角色的不同时空版本
 */
function findSameCharCollisions(participants: CrosstimeParticipant[]): Map<string, CrosstimeParticipant[]> {
    const groups = new Map<string, CrosstimeParticipant[]>();
    for (const p of participants) {
        const list = groups.get(p.charId) || [];
        list.push(p);
        groups.set(p.charId, list);
    }
    // 只保留有多个版本的
    const collisions = new Map<string, CrosstimeParticipant[]>();
    for (const [charId, list] of groups) {
        if (list.length > 1) collisions.set(charId, list);
    }
    return collisions;
}

/**
 * 组装导演 prompt
 */
export function buildCrosstimeDirectorPrompt(
    participantContexts: string,
    participantList: { pid: string; displayName: string; charId: string }[],
    recentMessages: string,
    userProfile: UserProfile,
    userMode: 'online' | 'invisible',
    sameCharCollisions: Map<string, CrosstimeParticipant[]>,
    characters: CharacterProfile[],
): string {
    const userSection = userMode === 'online'
        ? `用户「${userProfile.name}」正在场。角色们知道他的存在，可以与他互动。
   注意：如果某个角色是「相遇前」的切片，他不认识用户，会对这个陌生人感到好奇。`
        : `用户处于隐身状态。角色们**完全不知道**有人在旁观。
   禁止任何角色提到用户、对用户说话、或暗示有外人在场。`;

    // 同角色碰撞规则
    let collisionRules = '';
    if (sameCharCollisions.size > 0) {
        collisionRules = '\n### 同一角色碰撞规则\n';
        for (const [charId, versions] of sameCharCollisions) {
            const charName = characters.find(c => c.id === charId)?.name || '角色';
            const labels = versions.map(v => v.label).join('、');
            collisionRules += `- 房间里有 ${versions.length} 个不同时间的${charName}（${labels}）。
  年轻版本会觉得对方"莫名眼熟"但不理解为什么。年长版本可能会感慨、沉默、或欲言又止。
  他们不应该直接说"你是未来的我"，但可以隐约感知到某种联系。\n`;
        }
    }

    const participantIdList = participantList
        .map(p => `  - PID: "${p.pid}" → ${p.displayName}`)
        .join('\n');

    return `【系统：跨时空对话 · 导演模式】

${participantContexts}

### 场景设定
这是一个跨越时空的特殊空间。不同时间的他们被聚集在这里。
${userSection}

### 参与者 ID 映射
${participantIdList}
${collisionRules}
### 最近对话记录
${recentMessages || '（暂无对话记录，这是第一轮）'}

### 导演任务
请作为导演，接管所有角色，让对话**自然地流动起来**。

### 核心规则
1. **去中心化**: 角色之间要有互动和回应，不要每个人说完就消失。
2. **多轮输出**: 一次生成 **2 到 6 条** 消息。
3. **气泡分段**: 长话分多条，每行是一个独立气泡。
4. **时空隔离**: 每个角色只知道自己时间线内的事。年轻版本不知道未来。
5. **性格一致**: 严格按照每个切片的人格档案行事。17岁叛逆期的他和现在温柔的他，说话方式完全不同。
${userMode === 'online' ? `6. **私聊**: 角色可以悄悄对用户说话，使用格式 \`[[PRIVATE: 内容]]\`。这条不会被其他角色看到。` : ''}

### 输出格式 (JSON Array)
严格输出 JSON，不要有任何多余文字。
[
  {
    "participantId": "参与者的PID",
    "content": "发言内容"
  },
  ...
]
`;
}

/**
 * 将消息列表格式化为可读的对话记录
 */
export function formatCrosstimeMessages(
    messages: CrosstimeMessage[],
    participants: CrosstimeParticipant[],
    characters: CharacterProfile[],
    userProfile: UserProfile,
    limit: number = 30,
): string {
    const recent = messages.slice(-limit);
    if (recent.length === 0) return '';

    return recent.map(m => {
        if (m.role === 'user') {
            if (m.isPrivate) {
                const target = participants.find(p => p.id === m.privateTargetId);
                const targetChar = target ? characters.find(c => c.id === target.charId) : null;
                const targetName = targetChar ? `${targetChar.name}·${target?.label}` : '某人';
                return `[${userProfile.name} 悄悄对 ${targetName} 说]: ${m.content}`;
            }
            return `${userProfile.name}: ${m.content}`;
        }
        const participant = participants.find(p => p.id === m.participantId);
        const char = participant ? characters.find(c => c.id === participant.charId) : null;
        const displayName = char ? `${char.name}·${participant?.label}` : '未知';
        return `${displayName}: ${m.content}`;
    }).join('\n');
}

export { findSameCharCollisions };
