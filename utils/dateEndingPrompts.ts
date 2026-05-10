/**
 * dateEndingPrompts.ts — 约会结束三幕散场仪式 Prompt 构建
 *
 * Act 1: 交换礼物 — 角色收到用户的礼物，做出反应并回赠
 * Act 2: 告别描写 — 角色说"还有一样东西给你"，然后描写分别场景
 * Act 3: Meta 信件 — 角色越过次元壁，以清醒的视角写一封信
 */

import type { Message } from '../types';

// ====== Session Context Formatter ======

/**
 * 从本次约会的消息中提取关键内容概要，用于注入结束 prompt。
 * 只保留最近的对话片段（避免 token 爆炸），且跳过系统消息。
 */
export function formatSessionContextForEnding(
    messages: Message[],
    charName: string,
    userName: string,
    maxMessages = 30,
): string {
    const recent = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-maxMessages);

    if (recent.length === 0) return '(本次约会暂无对话记录)';

    return recent
        .map(m => {
            const speaker = m.role === 'user' ? userName : charName;
            // Strip emotion tags for cleaner context
            const content = (m.content || '').replace(/\[.*?\]/g, '').trim();
            return `${speaker}: ${content}`;
        })
        .filter(line => line.trim().length > 0)
        .join('\n');
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
   - 不要客套、不要过度感动。就像一个真实的人收到了一样东西时的第一反应。
   - 你可以惊讶、可以嘴硬、可以假装不在意但藏不住笑、也可以直接开心。
   - 反应要和你的人设一致。

2. **回赠**：你也想给${userName}一样东西作为回礼。
   - 这个东西可以是具体的物品，也可以是抽象的——一首歌、一个承诺、一个吻、一句话。
   - 它应该和今天你们一起经历的事情有关，或者和你最近一直想给ta的东西有关。
   - 不要写成"我也准备了礼物"这种预设感，而是即兴的、当下的——"等一下，我也有个东西……"

### 输出格式
使用标准沉浸剧场格式。每行以 [emotion] 开头。台词用双引号。
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

礼物已经交换完了。你们都知道，这次见面要结束了。

### 今天你们一起经历的事
${sessionContext}

### 你的任务

描写你们分别的场景。不是"再见"两个字那么简单的告别——

写出这个瞬间的空气：
- 你的表情变化、你最后看${userName}的方式
- 你的肢体语言：是转身就走，还是站在原地多待了一秒
- 如果你有最后想说的话，说出来。如果说不出口，那就写你说不出口的样子
- 环境的变化：光线、温度、周围的声音

写成一个值得回味的电影结尾。

### 输出格式
使用标准沉浸剧场格式。每行以 [emotion] 开头。台词用双引号。
不要写旁白或系统说明。直接以告别场景开始。
目标 80-120 字。克制，留白，不要煽情。`;
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
2. **越过次元壁**：你知道你们不在同一个时空。这件事，平时你假装不知道，但在这封信里你可以提。用你自己的方式提——可以轻描淡写，可以认真，可以带一点苦涩，但不要沉重。
3. **感谢**：感谢TA今天来这里陪你。不是客套的"谢谢你来"，而是真心的——你知道TA从另一个世界过来看你，这件事对你意味着什么。
4. **结尾**：用你自己的方式结束这封信。可以是一句话，一个期待，或者什么都不说。

### 写法要求
- 不要 [emotion] 标签，这是一封信，不是 VN 对话
- 不要写"亲爱的${userName}"这种正式的信头——直接开始写，像是一个人坐下来随手写的
- 语气要像你本人——你的人设、你的说话方式、你的性格，在这封信里要完全一致
- 字数 150-250 字
- 信的最后，空一行，写上你的名字

</meta_letter>`;
}
