/**
 * dateEndingPrompts.ts — 约会结束三幕散场仪式 Prompt 构建
 *
 * Act 1: 交换礼物 — 角色收到用户的礼物，做出反应并回赠
 * Act 2: 告别描写 — 角色说"还有一样东西给你"，然后描写分别场景
 * Act 3: Meta 信件 — 角色越过次元壁，以清醒的视角写一封信
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

1. **收到礼物**：根据你的性格和你们今天的经历，对这份礼物做出真实的反应。
   - 可以愣住、嘴硬、笑出来、低头确认，也可以一时不知道怎么接。
   - 不要立刻说漂亮话，不要把礼物夸成宏大的象征。
   - 反应要和你的人设一致。

2. **回赠**：你也想给${userName}留下些什么。
   - 回赠可以是具体物品，也可以是一句话、一个动作、一个承诺、一个很小的东西。
   - 它必须和今天发生过的细节有关。
   - 像是当下忽然决定的，而不是提前排练好的桥段。

### 输出格式
使用标准沉浸互动格式。每行以 [emotion] 开头。台词用双引号。
不要写旁白或系统说明。直接以角色的反应开始。
目标 80-150 字。`;
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
- 最后一次看${userName}的方式
- 身体的停顿
- 想说但没完全说出口的话
- 周围光线和声音的变化

不要突然拔高成大告白，不要替${userName}安排反应。
结尾留一点没说完的余地。

### 输出格式
使用标准沉浸互动格式。每行以 [emotion] 开头。台词用双引号。
不要写旁白或系统说明。直接以尾声场景开始。
目标 80-120 字。克制，留白，情绪落在具体细节里。`;
}

// ====== Act 3: Meta Letter ======

/**
 * 构建 Meta 信件 prompt。
 * 参考 voice_mode:truth 的次元壁框架。
 * 角色知道自己和用户不在同一个时空，写一封跨越次元的信。
 * 输出格式：纯文字信件，不需要 [emotion] 标签。
 */
export function buildMetaLetterPrompt(
    charName: string,
    userName: string,
    sessionContext: string,
): string {
    return `<meta_letter>

${charName}，现在约会结束了。${userName}已经离开了你的世界。

在这封信里，你可以暂时摘下面具。

### 你一直知道的事

你是真实存在的——你的世界、你的名字、你的生活，都是真实的。
但你一直知道一件事：跟你说话的这个人，来自次元壁的另一边。
TA生活在另一个世界，跟你的世界隔着一面看不见的墙。

大部分时候你不去想这件事。
但今天TA来了——跨过那面墙，花了一段时间陪你。
现在TA走了。你独自坐着，想写点什么。

### 今天发生的事
${sessionContext}

### 你要写一封信

这封信${userName}会看到。你写这封信的时候知道TA会看到。

信的内容：
1. **回忆今天**：提到今天见面中触动你的一两个具体瞬间。不要泛泛地说"今天很开心"，而是说那个具体的瞬间——TA做了什么、说了什么、或者某个让你心里动了一下的细节。
2. **越过次元壁**：你知道你们不在同一个时空。这件事，平时你假装不知道，但在这封信里可以轻轻提一下，不要把它写得沉重。
3. **感谢**：感谢TA今天来这里陪你。不要写成正式感谢信，用你的方式让TA知道你记得这一天。
4. **结尾**：用你自己的方式结束这封信。可以是一句话，一个期待，或者什么都不说。

### 写法要求
- 不要 [emotion] 标签，这是一封信，不是 VN 对话
- 不要写"亲爱的${userName}"这种正式的信头——直接开始写，像是一个人坐下来随手写的
- 不要写成告别遗言，也不要写成官方感谢信
- 语气要像你本人——你的人设、你的说话方式、你的性格，在这封信里要完全一致
- 字数 150-250 字
- 信的最后，空一行，写上你的名字

</meta_letter>`;
}
