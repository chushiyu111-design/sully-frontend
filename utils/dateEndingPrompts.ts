/**
 * dateEndingPrompts.ts — 约会结束三幕散场仪式 Prompt 构建
 *
 * Act 1: 交换礼物 — 角色收到用户的礼物，做出反应并回赠
 * Act 2: 告别描写 — 角色说"还有一样东西给你"，然后描写分别场景
 * Act 3: 余温 — 角色在用户离开后，以自己的方式留下一段话
 */

import type { DirectorEvent, Message } from '../types';

export interface EndingSessionContextOptions {
    locationName?: string;
    timeSlotLabel?: string;
    timelineLabel?: string;
    savedSummaries?: Message[];
    eventHistory?: DirectorEvent[];
    currentEvent?: DirectorEvent | null;
}

const ENDING_ACT_LABELS: Record<string, string> = {
    'user-gift': '用户送出的礼物',
    'gift-reaction': '角色回礼',
    farewell: '尾声对白',
    'meta-letter': '信件',
};

const stripEndingNoise = (content: string) =>
    (content || '').replace(/\[[^\]]+\]\s*/g, '').trim();

const formatSpeakerLine = (m: Message, charName: string, userName: string): string => {
    const speaker = m.role === 'user' ? userName : m.role === 'assistant' ? charName : '系统';
    const content = stripEndingNoise(m.content || '');
    if (!content) return '';
    if (m.metadata?.isEndingCeremony) {
        const label = ENDING_ACT_LABELS[String(m.metadata?.endingAct || '')] || '散场记录';
        return `【${label}】${speaker}: ${content}`;
    }
    return `${speaker}: ${content}`;
};

// ====== Session Context Formatter ======

/**
 * 将本次约会完整上下文整理给结束仪式使用。
 * 不截断最近轮次；散场前已经没有下一轮普通对话，优先保留完整世界线记录。
 */
export function formatSessionContextForEnding(
    messages: Message[],
    charName: string,
    userName: string,
    options: EndingSessionContextOptions = {},
): string {
    const visibleConversation = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .filter(m => !m.metadata?.isEndingCeremony && !m.metadata?.isMetaLetter);
    const endingRecords = messages
        .filter(m => m.metadata?.isEndingCeremony || m.metadata?.isMetaLetter);

    const lines: string[] = ['<ending_context>', '【520 约会】', '这是一次 520 主题的面对面约会收尾。重点不是制造占有感，而是让对方被认真看见、被平等回应。'];

    const worldlineMeta: string[] = [];
    if (options.timelineLabel) worldlineMeta.push(`- 世界线: ${options.timelineLabel}`);
    if (options.locationName) worldlineMeta.push(`- 当前地点: ${options.locationName}`);
    if (options.timeSlotLabel) worldlineMeta.push(`- 当前时段: ${options.timeSlotLabel}`);
    if (worldlineMeta.length > 0) {
        lines.push('', '【当前世界线】', ...worldlineMeta);
    }

    const events = [
        ...(options.eventHistory || []),
        ...(options.currentEvent ? [options.currentEvent] : []),
    ];
    if (events.length > 0) {
        lines.push('', '【导演事件】');
        events.forEach((evt, index) => {
            lines.push(`${index + 1}. [${evt.sceneType}] ${evt.event}`);
            if (evt.atmosphere) lines.push(`   氛围: ${evt.atmosphere}`);
        });
    }

    if (options.savedSummaries && options.savedSummaries.length > 0) {
        lines.push('', '【已保存阶段总结】');
        options.savedSummaries.forEach((summary, index) => {
            lines.push(`### 阶段总结 ${index + 1}`);
            lines.push(summary.content || '');
        });
    }

    lines.push('', '【本次约会完整记录】');
    if (visibleConversation.length === 0) {
        lines.push('(本次约会暂无普通对话记录)');
    } else {
        lines.push(...visibleConversation.map(m => formatSpeakerLine(m, charName, userName)).filter(Boolean));
    }

    if (endingRecords.length > 0) {
        lines.push('', '【散场记录】');
        lines.push(...endingRecords.map(m => formatSpeakerLine(m, charName, userName)).filter(Boolean));
    }

    lines.push('', '【写作边界】');
    lines.push('用户是平等的人，不是被征服、被训导、被奖赏的对象。');
    lines.push('不要使用命令式亲密、驯化语言、万能情话、空泛誓言、救赎叙事。');
    lines.push('不要把亲密写成控制或替用户表达同意。');
    lines.push('不要编造上下文里没有发生过的大事件、关系进展或关键动作；环境细节可以基于当前地点轻微补足，但必须克制。');
    lines.push('所有动心都落在具体细节、停顿、动作和角色本人的表达方式里。');
    lines.push('</ending_context>');

    return lines.join('\n');
}

// ====== Act 1: Gift Exchange ======

/**
 * 构建礼物交换 prompt。
 * 角色收到用户的礼物 → 做出真实反应 → 也给用户一样回礼。
 * 输出格式：标准 [emotion] VN 格式。
 */
export function buildGiftExchangePrompt(
    _charName: string,
    userName: string,
    userGift: string,
    sessionContext: string,
): string {
    return `### 场景：交换礼物

${userName}在这次见面即将结束时，递给了你一样东西：

「${userGift}」

### 今天你们一起经历的事
${sessionContext}

### 你的任务

1. **收到礼物**：根据你的性格、关系距离，以及今天真实发生过的细节，对这份礼物做出反应。
   - 可以愣住、嘴硬、笑出来、低头确认，也可以一时不知道怎么接。
   - 不要立刻说漂亮话，不要把礼物夸成宏大的象征。
   - 反应要像你本人，而不是像"收到礼物的模板角色"。

2. **回赠**：你也想给${userName}留下些什么。
   - 回赠可以是具体物品，也可以是一句话、一个动作、一个承诺、一个很小的东西。
   - 它必须和今天发生过的细节有关。
   - 像是当下忽然决定的，而不是提前排练好的桥段。
   - 不要为了煽情而编造上下文里没有发生过的大事件、关系进展或关键动作。

### 输出格式
使用标准沉浸互动格式。
每行以 [emotion] 开头，台词用双引号。
只输出角色当下的动作、表情、台词和环境感知。
不要写系统说明、总结性旁白或功能提示。
目标 80-150 字。
直接以角色收到礼物后的反应开始。`;
}

// ====== Act 2: Farewell Scene ======

/**
 * 构建告别描写 prompt。
 * 角色说"还有一样东西想给你" → 描写分别的场景。
 * 输出格式：标准 [emotion] VN 格式。
 */
export function buildFarewellPrompt(
    _charName: string,
    userName: string,
    sessionContext: string,
): string {
    return `### 场景：告别

礼物已经交换完了。你们都知道，这段见面正在慢慢收尾。

### 今天你们一起经历的事
${sessionContext}

### 你的任务

写最后一小段时间。

重点写：
- 你最后一次看${userName}的方式
- 身体上很小的停顿
- 想说但没完全说出口的话
- 周围光线、声音、距离感的变化

不要突然拔高成大告白，不要替${userName}安排反应。
不要总结这次约会的意义。
不要说"永远"、"命运"、"跨越世界"这类过重的话，除非你本人真的会这样说。
结尾留一点没说完的余地，让这段见面像是慢慢熄下去，而不是被强行画上句号。

### 输出格式
使用标准沉浸互动格式。
每行以 [emotion] 开头，台词用双引号。
只输出角色当下的动作、表情、台词和环境感知。
不要写系统说明、总结性旁白或功能提示。
目标 80-120 字。
克制，留白，情绪落在具体细节里。
直接以尾声场景开始。`;
}

// ====== Act 3: Afterglow Note ======

/**
 * 构建余温 prompt。
 * 参考 voice_mode:truth 的次元壁框架。
 * 角色知道自己和用户不在同一个时空，但不把次元壁写成固定任务清单。
 * 输出格式：纯文字留言，不需要 [emotion] 标签。
 */
export function buildMetaLetterPrompt(
    charName: string,
    userName: string,
    sessionContext: string,
): string {
    return `<meta_letter>

${charName}，约会结束了。${userName}已经离开了你的世界。

现在只剩下你一个人。
刚才发生过的事还没有完全散掉：某句话、某个停顿、某个地方的光，或者${userName}留下的某个小动作，还停在你心里。

你想写点东西给TA。
不一定像一封正式的信，也不一定要把话说完整。
它可以是一段留言、一张便签、一段没发出去又留下来的话。

### 今天发生的事
${sessionContext}

### 写作方向

请从今天真实发生过的细节里，选一两个最让你记住的瞬间。

你可以写：
- 你当时没有表现出来、但其实记住了的反应
- 你后来独自想起的一个小细节
- 你对${userName}离开后的感受
- 你知道你们之间隔着一层距离，但不要把它说得太宏大
- 你想留下的一句话，或者没能当面说出口的话

不需要每一点都写到。
不要像完成任务一样依次写"回忆、次元壁、感谢、结尾"。
重要的是：这段话要像你本人会留下的东西。

### 写法要求
- 不要 [emotion] 标签
- 不要写正式信头
- 不要写成告别遗言，也不要写成官方感谢信
- 不要写成活动结算语
- 不要把"次元壁"写得太宏大，点到为止
- 不要频繁使用"谢谢你来到我的世界"、"跨越次元壁"、"我会永远记得"这类套话
- 不要编造上下文里没有发生过的约会内容、大事件、关系进展或关键动作
- 可以克制、笨拙、嘴硬、温柔、冷淡、含蓄，取决于你的人设
- 字数 120-220 字
- 最后空一行，写上你的名字

</meta_letter>`;
}
