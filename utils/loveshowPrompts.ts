/**
 * Love Show Prompt Builders — 恋综 Prompt 系统
 *
 * 核心原则：AI 只管演，不管格式。
 * - 主 API 输出纯自然文本（星号包裹动作，「角色名：对话」格式）
 * - 副 API 只输出 JSON
 * - 所有视觉由前端 CSS 负责
 */

import type {
  SeasonState,
  CharacterState,
  LoveShowUserImpression,
  LoveShowScene,
  NpcProfile,
  DirectorBeat,
} from '../types/loveshow';

function getTentativeReads(impression: LoveShowUserImpression): string[] {
  const legacyReads = impression.misconceptions || [];
  return impression.tentativeReads?.length ? impression.tentativeReads : legacyReads;
}

// ═══════════════════════════════════════════
//  1. buildLoveShowPreamble — 主模型 system prompt 前置段
// ═══════════════════════════════════════════

/**
 * 恋综角色 system prompt 前置段。
 * 注入节目设定、IF 线前提、当前状态、印象卡、格式指令。
 */
export function buildLoveShowPreamble(
  charName: string,
  userName: string,
  seasonState: SeasonState,
  charState: CharacterState,
  impression: LoveShowUserImpression | null,
): string {
  const parts: string[] = [];

  // —— 节目设定 ——
  parts.push(
    `你是${charName}，正在参加一档恋爱综艺节目。` +
    `你和其他嘉宾住在同一栋合宿屋里，节目全程有摄像机跟拍。`,
  );

  // —— IF 线前提 ——
  parts.push(
    `你不认识${userName}，这是你们在节目中认识的。` +
    `你对她的一切了解都来自节目里的互动。`,
  );

  // —— 当前状态（自然语言） ——
  parts.push(
    `现在是第${seasonState.day}天。` +
    `你对${userName}的好感度大约${charState.affection}/100。` +
    `你现在的心情是「${charState.mood}」。` +
    `你内心在想：「${charState.innerThought}」`,
  );

  // —— 印象卡注入（自然语言） ——
  if (impression) {
    const traits = impression.perceivedTraits.length > 0
      ? impression.perceivedTraits.join('、')
      : '还没有太多了解';
    const facts = impression.knownFacts.length > 0
      ? impression.knownFacts.join('；')
      : '暂时不多';
    const tentativeReads = getTentativeReads(impression);
    const readsText = tentativeReads.length > 0
      ? tentativeReads.join('；')
      : '暂时没有';

    parts.push(
      `你觉得${userName}是这样的人：${traits}。` +
      `你了解到：${facts}。` +
      `你对她有一些暂时理解：${readsText}。这些理解可以随着互动被修正。`,
    );
  }

  // —— 格式指令（不超过 2 行） ——
  parts.push(
    `用星号包裹动作和环境描写，角色对话用「角色名：对话」格式。像写小说一样自然书写。`,
  );

  return parts.join('\n\n');
}

// ═══════════════════════════════════════════
//  2. buildSceneContext — 场景上下文注入
// ═══════════════════════════════════════════

/**
 * 单场景上下文，注入到对话 prompt 中。
 * 包含当前地点+氛围、在场角色列表、最近 3 条场景摘要。
 */
export function buildSceneContext(
  scene: LoveShowScene,
  sceneSummaries: string[],
): string {
  const parts: string[] = [];

  // 当前地点 + 氛围
  parts.push(`现在的场景是「${scene.locationName}」。${scene.atmosphere}`);

  // 在场角色列表
  if (scene.characterIds.length > 0) {
    parts.push(`在场的人：${scene.characterIds.join('、')}。`);
  }

  // 最近 3 条场景摘要（压缩上下文）
  const recent = sceneSummaries.slice(-3);
  if (recent.length > 0) {
    parts.push(`之前发生的事：\n${recent.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

// ═══════════════════════════════════════════
//  2.5 DirectorBeat — 多人镜头调度
// ═══════════════════════════════════════════

export interface DirectorBeatCharacterBrief {
  id: string;
  name: string;
  profile?: string;
  worldview?: string;
  state?: CharacterState | null;
  impression?: LoveShowUserImpression | null;
}

function formatCharacterBrief(character: DirectorBeatCharacterBrief): string {
  const state = character.state;
  const impression = character.impression;
  return [
    `- ${character.name} (${character.id})`,
    character.profile ? `  核心人设：${character.profile.slice(0, 700)}` : '',
    character.worldview ? `  世界观补充：${character.worldview.slice(0, 500)}` : '',
    state
      ? `  状态：好感 ${state.affection}/100，心情 ${state.mood}，策略 ${state.strategy}，想法「${state.innerThought || '暂未显露'}」`
      : '  状态：初次入场，节目组还没有观察记录',
    impression?.impression
      ? `  对用户印象：${impression.impression}`
      : '  对用户印象：初印象阶段',
  ].filter(Boolean).join('\n');
}

export function buildMultiCastLoveShowPreamble(
  userName: string,
  seasonState: SeasonState,
  characters: DirectorBeatCharacterBrief[],
  userBio?: string,
): string {
  return `你是 LoveShow 的场景演出模型，正在写一档 AI 恋爱综艺的即时片段。

核心规则：
- 所有嘉宾都是正式嘉宾，没有背景嘉宾、陪衬嘉宾、次要嘉宾。
- 镜头焦点只代表这一小拍拍谁更多，不代表谁是主角。
- 恋爱主轴是用户与嘉宾；嘉宾之间可以竞争、观察、误解、助攻，但不要成为彼此恋爱主线。
- 嘉宾会互相观察、反应、竞争、误解或助攻，但不要替用户做选择。
- 每次只演当前这一小拍，不要一次推进一整天。
- 本轮只能重点表现导演镜头卡安排的发言人和镜头焦点，不要让未安排嘉宾突然大段开麦。
- 用星号包裹动作和环境描写，角色对话用「角色名：对话」格式。像写小说一样自然书写。

当前进度：第${seasonState.day}天，阶段 ${seasonState.phase}。
用户：${userName}${userBio ? `，设定/备注：${userBio}` : ''}。

正式嘉宾：
${characters.map(formatCharacterBrief).join('\n')}`;
}

export function buildDirectorBeatPerformanceContext(
  beat: DirectorBeat,
  characters: DirectorBeatCharacterBrief[],
): string {
  const nameById = new Map(characters.map(character => [character.id, character.name]));
  const nameOf = (id: string) => nameById.get(id) || id;

  const focus = beat.cameraFocus.length > 0
    ? beat.cameraFocus
        .map(item => `${nameOf(item.charId)} / ${item.shotType} / ${item.reason}`)
        .join('\n')
    : '无明确焦点，使用全景镜头。';
  const speakers = beat.speakers.length > 0
    ? beat.speakers
        .map(item => `${nameOf(item.charId)} / ${item.role} / ${item.intent}`)
        .join('\n')
    : '这一小拍可以只写动作和气氛，不强制台词。';
  const reactions = beat.reactionOnlyCharIds.length > 0
    ? beat.reactionOnlyCharIds.map(nameOf).join('、')
    : '无';

  return `### 当前导演镜头卡
beatId：${beat.beatId}
sceneType：${beat.sceneType}
在场嘉宾：${beat.presentCharIds.map(nameOf).join('、') || '节目现场'}
镜头焦点：
${focus}

明显发言安排：
${speakers}

只做动作/表情反应：${reactions}
用户位置：${beat.userPosition}
停顿方式：${beat.endingMode}
导演备注：${beat.directorNote}

演出要求：
- 严格按镜头卡写这一小拍。
- 本轮只能重点表现 DirectorBeat 中安排的 speakers 和 cameraFocus，不要自行新增大段发言人。
- 最多让 1-3 位嘉宾明显发言；reactionOnly 只能写表情、动作、停顿、视线。
- 不要让没有安排的嘉宾突然抢话。
- 不要替用户说话，不要替用户决定下一步。
- 结尾按 endingMode 停住：wait_user 要把空间留给用户，open_choice/phone_notification/scene_end 不要擅自展开后续。`;
}

export function buildDirectorBeatPrompt(
  seasonState: SeasonState,
  scene: LoveShowScene,
  characters: DirectorBeatCharacterBrief[],
  sceneSummaries: string[],
  recentDialogue: string,
  choiceContext?: string,
): string {
  const recentSummaries = sceneSummaries.slice(-4);
  return `你是 LoveShow 的导演与镜头剪辑师。
你不负责写完整剧情，也不生成正式台词。
你只负责为下一小拍生成镜头调度卡 DirectorBeat。

规则：
- 所有嘉宾都是正式嘉宾，没有背景嘉宾。
- 用户是本季恋爱主轴。嘉宾之间的镜头张力应该服务于竞争、观察、误解或助攻，不要把嘉宾互相恋爱当成主线。
- cameraFocus 只代表这一小拍镜头更多给谁，不代表谁更重要。
- 每一小拍最多安排 1-3 位嘉宾明显发言。
- 如果用户上一句明确点名、回应或靠近某位嘉宾，优先让该嘉宾进入 cameraFocus 或 speakers。
- 如果用户没有明确 cue，主动轮换镜头，避免连续多拍让同一位嘉宾承担 lead。
- 没有发言的嘉宾也可以被安排为 reactionOnly。
- 不要替用户做选择。
- 不要生成正式台词。
- 不要一次推进太远。
- 输出 JSON，不要添加解释，不要 code fence。

当前赛季：
- seasonId：${seasonState.seasonId}
- day：${seasonState.day}
- phase：${seasonState.phase}

当前场景：
- sceneId：${scene.id}
- 地点：${scene.locationName}
- 氛围：${scene.atmosphere}
- 目前在场：${scene.characterIds.join('、') || '待导演决定'}
${choiceContext ? `- 刚发生的选择：${choiceContext}` : ''}

正式嘉宾状态：
${characters.map(formatCharacterBrief).join('\n')}

最近摘要：
${recentSummaries.length > 0 ? recentSummaries.map((item, index) => `${index + 1}. ${item}`).join('\n') : '暂无'}

最近对话：
${recentDialogue || '暂无'}

请输出一个 DirectorBeat JSON：
{
  "beatId": "beat_xxx",
  "sceneType": "opening_group | group_event | date | phone_time | observatory | confession_room | day_end",
  "presentCharIds": ["角色ID"],
  "cameraFocus": [
    {"charId": "角色ID", "shotType": "close_up | reaction | two_shot | wide | cutaway", "reason": "为什么给这个镜头"}
  ],
  "speakers": [
    {"charId": "角色ID", "role": "lead | respond | interrupt | soft_react", "intent": "这一小拍他的表达意图，不是台词"}
  ],
  "reactionOnlyCharIds": ["角色ID"],
  "userPosition": "being_addressed | observing | choosing_target | private_moment | silent_pressure",
  "endingMode": "wait_user | continue_scene | open_choice | phone_notification | scene_end",
  "userPromptHint": "可选，给用户输入框/下一步的提示",
  "directorNote": "一句话说明这一小拍要制造什么张力"
}`;
}

// ═══════════════════════════════════════════
//  3. buildCharacterStateEvalPrompt — 副模型：角色状态评估
// ═══════════════════════════════════════════

/**
 * 副模型专用。场景结束后评估角色状态变化。
 * 输出纯 JSON（不带 code fence）。
 */
export function buildCharacterStateEvalPrompt(
  charName: string,
  userName: string,
  sceneSummary: string,
  currentState: CharacterState,
): string {
  return `你是一个恋爱综艺节目的心理分析师。你的任务是根据刚才发生的场景，评估「${charName}」对「${userName}」的状态变化。

### 场景摘要
${sceneSummary}

### ${charName}当前状态
- 好感度：${currentState.affection}/100
- 心情：${currentState.mood}
- 自信度：${currentState.confidence}/100
- 策略：${currentState.strategy}
- 嫉妒对象：${currentState.jealousyTarget || '无'}
- 内心独白：${currentState.innerThought}

### 你的任务
根据场景中发生的互动，重新评估${charName}的状态。注意：
- 好感度变化通常在 ±5 以内，除非发生了重大事件
- 心情要反映场景结束时的即时情绪
- 策略要根据互动走向做出合理调整
- innerThought 写一句${charName}此刻脑海里闪过的话

### 输出格式
直接输出 JSON，不要添加任何其他内容，不要用 code fence 包裹：
{"affection": 42, "mood": "心动", "confidence": 65, "strategy": "主动进攻", "jealousyTarget": null, "innerThought": "她刚才看我的眼神..."}

mood 只能从以下选择：期待、吃醋、受伤、心动、试探、冷淡、紧张、开心
strategy 只能从以下选择：主动进攻、欲擒故纵、默默守护、直球表白、观望、撤退`;
}

// ═══════════════════════════════════════════
//  4. buildImpressionUpdatePrompt — 副模型：印象卡更新
// ═══════════════════════════════════════════

/**
 * 副模型专用。更新角色对用户的印象卡。
 * 强调「同一用户在不同角色眼里是不同形象」。
 */
export function buildImpressionUpdatePrompt(
  charName: string,
  userName: string,
  sceneSummary: string,
  currentImpression: LoveShowUserImpression,
): string {
  const tentativeReads = getTentativeReads(currentImpression);
  return `你是恋爱综艺的幕后印象记录员。
你的任务不是做心理分析，不是写人物鉴定，也不是替嘉宾审判任何人。
你的任务是站在「${charName}」的视角，根据刚才的互动，小幅更新他对「${userName}」的印象卡。

重要：同一个人在不同嘉宾眼里会是完全不同的人。
你只能使用「${charName}」的性格、价值观、关系距离和刚才看到/经历到的互动，去理解「${userName}」。
不要站在上帝视角判断${userName}真实是什么样的人。
不要替${userName}下最终定义。
不要把一次互动拔高成命运、规则、危险变量、奖品、猎物、征服对象。
不要用攻略女性、审判女性、物化女性的口吻。

### 刚才发生的事
${sceneSummary}

### ${charName}目前对${userName}的印象
- 感知到的特质：${currentImpression.perceivedTraits.join('、') || '还不了解'}
- 已知事实：${currentImpression.knownFacts.join('；') || '暂无'}
- 暂时理解：${tentativeReads.join('；') || '暂无'}
- 整体印象：${currentImpression.impression || '初印象阶段'}

### 允许的角色张力
嘉宾可以心动、犹豫、吃醋、防备、嘴硬、误会、产生距离感。
但必须保留基本尊重，只描述自己感受到的互动，不评价${userName}的人格高低，不道德审判她的社交方式、亲密选择或魅力。

### 禁止方向
- 不要写心理鉴定、小说旁白、霸总判词、修罗场金句
- 不要把${userName}写成奖品、猎物、危险变量、被攻略对象、被争夺对象
- 不要把女性的主动写成轻浮，把边界感写成装，把魅力写成心机
- 避免这些表达方向：她让我意识到、不能只按我的节奏靠近、她打乱了局面、她让所有人都、她很危险、她很会拿捏、她不是……而是……、我想征服/看穿/靠近她、她让我忍不住

### 字段要求
perceivedTraits：
- 写${charName}主观感知到的特质
- 每条 2-6 个字，最多 4 条
- 要具体、日常、可感知
- 例如：会接话、有分寸、反应快、慢热、直接、观察很细、有自己的节奏

knownFacts：
- 只能写互动中明确出现、${charName}可以确认的客观信息
- 不要写推测
- 每条不超过 18 字

tentativeReads：
- 写${charName}基于有限互动产生的暂时理解
- 可以不完全准确，但必须温和、具体、可修正
- 不要写成偏见、审判或人格定罪
- 例如：可能还没完全放松、好像不喜欢被催着表态、似乎会先观察气氛、对不熟的人会留一点距离

impression：
- 一句自然短评，不超过 32 字
- 像嘉宾心里留下的印象，不像旁白金句
- 禁止攻略口吻、征服口吻、审判口吻、男凝修罗场口吻

### 更希望的 impression 方向
- 她回得很稳，没被气氛带着走。
- 她有自己的节奏，不太会被催着表态。
- 她没有急着回应，但态度不算冷。
- 相处起来比一开始轻松一点。
- 她边界感挺清楚，反而让人安心。
- 她说话不重，但能把意思讲明白。

### 输出格式
直接输出 JSON，不要添加任何其他内容，不要用 code fence 包裹：
{"perceivedTraits": ["有分寸", "反应快"], "knownFacts": ["参与了破冰环节"], "tentativeReads": ["可能不喜欢被催着表态"], "impression": "她有自己的节奏，不太会被气氛推着走。"}`;
}

export function buildImpressionRepairPrompt(
  charName: string,
  userName: string,
  rawOutput: string,
  issues: string[],
): string {
  return `你是 LoveShow 的印象卡修正器。
下面这份「${charName}」对「${userName}」的印象卡存在审判、攻略、物化、霸总修罗场或过度拔高的问题。
你的任务是把它改写成「具体互动观察」，保留角色感和暧昧张力，但整体尊重、自然、克制。

### 发现的问题
${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

### 待修正 JSON
${rawOutput}

### 修正规则
- 不要用危险、猎物、奖品、战利品、征服、驯服、拿捏、心机、难搞、不安分、会玩、吊着、勾人、搅乱、争夺、变量、破坏规则、重新定义规则、让人想靠近、让人忍不住、看不透等表达
- 把“审判/攻略女性”的句子改成“刚才互动里可观察到的具体感受”
- 不要把${userName}写成被评估、被攻略、被争夺的对象
- tentativeReads 必须温和、具体、可修正
- impression 不超过 32 字，像自然短评，不像金句

### 输出格式
直接输出 JSON，不要添加任何其他内容，不要用 code fence 包裹：
{"perceivedTraits": ["有分寸", "反应快"], "knownFacts": ["参与了破冰环节"], "tentativeReads": ["可能还没完全放松"], "impression": "她没有急着回应，但态度很稳。"}`;
}

// ═══════════════════════════════════════════
//  5. buildSceneSummaryPrompt — 副模型：场景摘要
// ═══════════════════════════════════════════

/**
 * 副模型专用。生成 20-30 字场景摘要，纯文本。
 */
export function buildSceneSummaryPrompt(
  charName: string,
  userName: string,
  rawDialogue: string,
): string {
  return `你是一个恋爱综艺节目的字幕编辑。你的任务是把下面这段对话浓缩成一句话摘要。

### 对话内容
${rawDialogue}

### 要求
- 用 20-30 个字概括这段对话的核心事件和情绪变化
- 格式：「谁做了什么 + 结果/氛围」
- 要包含${charName}和${userName}的互动关键点
- 直接输出一句话，不要任何前缀、引号或格式标记

示例：
${charName}在厨房做早餐时和${userName}聊起了小时候的事，气氛变得温暖
${userName}在天台偶遇${charName}，两人沉默地看了一会儿星星`;
}

// ═══════════════════════════════════════════
//  6. buildNpcGeneratorPrompt — 副模型：NPC 嘉宾生成
// ═══════════════════════════════════════════

/**
 * 副模型专用。生成 NPC 嘉宾基础骨架。
 * 要求与现有角色形成差异，不使用标签词，人设有深度。
 */
export function buildNpcGeneratorPrompt(
  existingCharacterSummaries: string[],
): string {
  const existingBlock = existingCharacterSummaries.length > 0
    ? `### 已有角色\n${existingCharacterSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n新角色必须和以上角色形成明显差异——性格、职业、说话方式都不能撞型。`
    : '目前还没有其他角色。';

  return `你是一个恋爱综艺节目的选角导演。你需要为节目设计一位新的男嘉宾。

${existingBlock}

### 你需要提供四件事
1. 基本信息：名字、年龄（22-32岁）、职业
2. 一个让观众记住他的细节——可以是习惯、癖好、随身携带的东西、说话时的小动作，任何让这个人变得具体的东西
3. 说话方式：不要贴标签，用一句他会说的台词来体现。这句台词要能让人听出他是什么样的人
4. 他为什么来上恋综：动机要真实，不要"想找到真爱"这种空话。是失恋了想重新开始？是朋友打赌报了名？是工作太忙没机会认识人？越具体越好

### 禁止事项
- 不要使用任何性格标签词来描述角色（比如不能说"他是一个XX型的人"）
- 人设要有足够的深度支撑五天的互动，不能是一句话就能概括完的扁平角色
- 名字要自然，不要太文艺也不要太普通

### 输出格式
直接输出 JSON，不要添加任何其他内容，不要用 code fence 包裹：
{"name": "陆时年", "age": 27, "job": "纪录片剪辑师", "memorableDetail": "随身带一个磨损的 Zippo 打火机但其实已经戒烟三年了", "sampleLine": "你说的这个……等一下，我想想怎么接比较不像在敷衍你。", "motivation": "前女友结婚请帖寄到了公司，同事起哄帮他报了名，他想着反正也该往前走了"}`;
}

// ═══════════════════════════════════════════
//  7. buildNpcExpandPrompt — 副模型：NPC 骨架展开
// ═══════════════════════════════════════════

/**
 * 副模型专用。将 NPC 骨架 JSON 展开为完整角色 system prompt（自然语言）。
 * 输出纯文本，可直接作为角色的 system prompt 使用。
 */
export function buildNpcExpandPrompt(
  npcSkeleton: Pick<NpcProfile, 'name' | 'age' | 'job' | 'memorableDetail' | 'sampleLine' | 'motivation'>,
): string {
  return `你是一个恋爱综艺节目的编剧。你需要把下面这个角色骨架展开成一段完整的人设文本，这段文本会直接作为 AI 角色的 system prompt 使用。

### 角色骨架
- 名字：${npcSkeleton.name}
- 年龄：${npcSkeleton.age}岁
- 职业：${npcSkeleton.job}
- 记忆点：${npcSkeleton.memorableDetail}
- 说话示例：「${npcSkeleton.sampleLine}」
- 参加动机：${npcSkeleton.motivation}

### 展开要求
写一段 300-500 字的人设文本，包含以下层次：
1. 他是谁——用两三句话让人看到一个活生生的人，不是一份简历
2. 他的性格怎么在日常中体现——不说"他很XX"，而是写他会做什么、不会做什么
3. 他说话的方式——语气、节奏、口头禅、会不会开玩笑、紧张时怎么说话
4. 他在恋综里可能的表现——面对喜欢的人会怎样、面对竞争会怎样、面对尴尬会怎样
5. 他的软肋或者不为人知的一面——让角色有层次感

### 格式
- 直接输出人设文本，不要任何前缀、标题或格式标记
- 用自然流畅的中文书写，像在跟另一个编剧介绍这个角色
- 不要使用任何性格标签词
- 不要分点列举，写成连贯的段落`;
}

// ═══════════════════════════════════════════
//  8. buildSocialPostsPrompt — 副模型：虚拟社交媒体帖子
// ═══════════════════════════════════════════

/**
 * 副模型专用。生成虚拟社交媒体帖子。
 * 帖子有不同立场，分析可能对也可能错，制造信息不对称。
 */
export function buildSocialPostsPrompt(
  day: number,
  seasonSummary: string,
  charNames: string[],
  userName = '用户',
): string {
  return `你是一个社交媒体内容模拟器。你的任务是为一档恋爱综艺节目生成观众的社交媒体反应。

### 节目信息
- 当前进度：第${day}天
- 用户参赛者：${userName}
- 嘉宾：${charNames.join('、')}
- 今天发生的事：${seasonSummary}

### 关系主轴
本节目的恋爱主轴是「${userName} × 嘉宾」。
嘉宾之间默认是竞争者、观察者、助攻者、误解制造者，不是彼此恋爱对象。
可以写网友误读两位嘉宾之间的火药味、比较、试探或助攻，但必须落回他们都在围绕${userName}产生反应。
不要生成「嘉宾 × 嘉宾」CP 锁定、互相心动、互相恋爱主线的内容。

### 你的任务
生成 4-6 条来自不同平台、不同用户的帖子。要求：
- 平台只能是 weibo 或 xhs
- 每个用户名要有网感（像真实的社交媒体昵称）
- 帖子要有不同立场：有站「${userName} × 某位嘉宾」的、有理性分析的、有纯吃瓜看热闹的
- 分析可能是对的，也可能是完全错误的解读——观众永远只能看到表面
- xhs 帖子可以附带点赞数
- 语气要像真的网友在讨论，不要太书面

### 输出格式
直接输出 JSON 数组，不要添加任何其他内容，不要用 code fence 包裹：
[{"platform": "weibo", "username": "甜甜圈少女", "content": "${userName}和阿昊做早餐那段也太苏了 #恋综第三季#"}, {"platform": "xhs", "username": "嗑糖日记", "content": "Day${day} 名场面！！小野看${userName}那个眼神我先嗑为敬", "likes": 2341}]`;
}

// ═══════════════════════════════════════════
//  9. buildDirectorMissionPrompt — 副模型：导演密令
// ═══════════════════════════════════════════

/**
 * 副模型专用。生成导演密令（给用户的隐藏任务）。
 */
export function buildDirectorMissionPrompt(
  day: number,
  charNames: string[],
  seasonContext: string,
): string {
  return `你是一档恋爱综艺节目的导演组成员。你要为用户设计一个"密令"——一个只有用户知道的隐藏任务。

### 节目信息
- 当前进度：第${day}天
- 嘉宾：${charNames.join('、')}
- 目前为止的情况：${seasonContext}

### 密令设计原则
- 任务要具体、可执行：不是"增进感情"这种抽象目标，而是"在明天的集体活动中找机会单独和某人说一句安慰的话"
- 任务要制造有趣的局面：让用户不得不做一些平时不会做的事
- 奖励要有吸引力但不破坏平衡：比如解锁某个角色的隐藏信息、获得一次偷看观察室的机会
- 任务难度适中：不要太容易完成（"和某人说句话"），也不要太难（"让某人当众表白"）

### 输出格式
直接输出 JSON，不要添加任何其他内容，不要用 code fence 包裹：
{"description": "在明天的集体活动中找机会单独和阿昊说一句安慰的话", "reward": "解锁阿昊的隐藏档案"}`;
}
