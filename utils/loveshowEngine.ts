/**
 * Love Show Engine — 恋综导演引擎 + 赛季状态机
 *
 * 导演的核心工作是「制造选择」——不排固定时间表，
 * 而是根据当前状态生成下一个选择点（ChoicePoint）。
 */

import {
  buildCharacterStateEvalPrompt,
  buildDirectorMissionPrompt,
  buildDirectorBeatPrompt,
  buildImpressionRepairPrompt,
  buildImpressionUpdatePrompt,
  buildNpcExpandPrompt,
  buildNpcGeneratorPrompt,
  buildSceneSummaryPrompt,
  buildSocialPostsPrompt,
  type DirectorBeatCharacterBrief,
} from './loveshowPrompts';
import type {
  SeasonState,
  SeasonPhase,
  ChoicePoint,
  ChoiceOption,
  CharacterState,
  LoveShowScene,
  LoveShowUserImpression,
  NpcProfile,
  LoveShowSocialPost,
  DirectorMission,
  DirectorBeat,
  DirectorBeatEndingMode,
  DirectorBeatSceneType,
  DirectorShotType,
  DirectorSpeakerRole,
  DirectorUserPosition,
} from '../types/loveshow';

// ═══════════════════════════════════════════════
//  常量：合宿屋地点 & 外出约会地点
// ═══════════════════════════════════════════════

/** 合宿屋地点常量 */
export const HOUSE_LOCATIONS: { id: string; name: string; atmosphere: string }[] = [
  { id: 'kitchen', name: '厨房', atmosphere: '日常温暖，偶遇感' },
  { id: 'living_room', name: '客厅', atmosphere: '公开热闹，群聊破冰' },
  { id: 'rooftop', name: '天台', atmosphere: '私密浪漫，夜聊告白' },
  { id: 'hallway', name: '走廊', atmosphere: '偶然暧昧，擦肩而过' },
  { id: 'garden', name: '院子', atmosphere: '轻松开放，集体活动' },
  { id: 'interview_room', name: '采访间', atmosphere: '独处真实，对镜头说心里话' },
];

/** 外出约会地点池 */
export const DATE_LOCATION_POOL: { id: string; name: string; atmosphere: string }[] = [
  { id: 'amusement_park', name: '游乐园', atmosphere: '刺激兴奋，容易拉近距离' },
  { id: 'seaside', name: '海边', atmosphere: '开阔浪漫，适合深聊' },
  { id: 'cafe', name: '咖啡馆', atmosphere: '安静私密，面对面' },
  { id: 'escape_room', name: '密室逃脱', atmosphere: '紧张合作，肢体接触' },
  { id: 'night_market', name: '夜市', atmosphere: '热闹随意，自然亲近' },
  { id: 'aquarium', name: '水族馆', atmosphere: '安静梦幻，适合并肩' },
  { id: 'bookstore', name: '独立书店', atmosphere: '文艺安静，偷看对方' },
  { id: 'hiking', name: '徒步', atmosphere: '运动出汗，互相照顾' },
];

// ═══════════════════════════════════════════════
//  内部工具
// ═══════════════════════════════════════════════

/** 生成简短唯一 ID */
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 把 day 映射到大致时段标签 */
type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * 根据赛季 day + phase 推导当前时段。
 * 纯启发式：phase 不同 → 时段不同。
 */
function inferPeriod(phase: SeasonPhase): DayPeriod {
  switch (phase) {
    case 'casting':
    case 'day_active':
      return 'afternoon';
    case 'phone_time':
      return 'night';
    case 'observatory':
      return 'night';
    case 'day_end':
      return 'night';
    default:
      return 'afternoon';
  }
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

const DIRECTOR_SCENE_TYPES = [
  'opening_group',
  'group_event',
  'date',
  'phone_time',
  'observatory',
  'confession_room',
  'day_end',
] as const satisfies readonly DirectorBeatSceneType[];

const DIRECTOR_SHOT_TYPES = [
  'close_up',
  'reaction',
  'two_shot',
  'wide',
  'cutaway',
] as const satisfies readonly DirectorShotType[];

const DIRECTOR_SPEAKER_ROLES = [
  'lead',
  'respond',
  'interrupt',
  'soft_react',
] as const satisfies readonly DirectorSpeakerRole[];

const DIRECTOR_USER_POSITIONS = [
  'being_addressed',
  'observing',
  'choosing_target',
  'private_moment',
  'silent_pressure',
] as const satisfies readonly DirectorUserPosition[];

const DIRECTOR_ENDING_MODES = [
  'wait_user',
  'continue_scene',
  'open_choice',
  'phone_notification',
  'scene_end',
] as const satisfies readonly DirectorBeatEndingMode[];

function inferDirectorSceneType(scene: LoveShowScene, season: SeasonState): DirectorBeatSceneType {
  if (scene.locationId === 'observatory') return 'observatory';
  if (scene.locationId === 'interview_room') return 'confession_room';
  if (season.phase === 'phone_time') return 'phone_time';
  if (season.phase === 'day_end') return 'day_end';
  if (scene.characterIds.length <= 1 && scene.locationId !== 'living_room') return 'date';
  return season.day === 1 && scene.locationId === 'living_room' ? 'opening_group' : 'group_event';
}

function activeSeasonCharIds(season: SeasonState): string[] {
  return season.charIds.filter(id => !season.eliminations.includes(id));
}

function stableIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function findCuedCharacterId(input: DirectorBeatInput, presentCharIds: string[]): string | null {
  let bestMatch: { id: string; index: number } | null = null;
  for (const character of input.characters) {
    if (!presentCharIds.includes(character.id) || !character.name) continue;
    const index = input.recentDialogue.lastIndexOf(character.name);
    if (index < 0) continue;
    if (!bestMatch || index > bestMatch.index) {
      bestMatch = { id: character.id, index };
    }
  }
  return bestMatch?.id || null;
}

// ═══════════════════════════════════════════════
//  1. 赛季生命周期
// ═══════════════════════════════════════════════

/** 创建新赛季 */
export function createSeason(charIds: string[]): SeasonState {
  return {
    seasonId: uid('season'),
    charIds: [...charIds],
    day: 1,
    phase: 'casting' as SeasonPhase,
    eliminations: [],
    finalChoice: null,
    startedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

/** 推进到下一天 */
export function advanceDay(season: SeasonState): SeasonState {
  const nextDay = season.day + 1;
  const isFinalDay = nextDay > 5;
  return {
    ...season,
    day: isFinalDay ? season.day : nextDay,
    phase: isFinalDay ? 'finale' : 'day_active',
    lastActiveAt: Date.now(),
  };
}

/** 更新赛季阶段 */
export function updatePhase(season: SeasonState, phase: SeasonPhase): SeasonState {
  return {
    ...season,
    phase,
    lastActiveAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════
//  2. 导演选择点生成（核心）
// ═══════════════════════════════════════════════

/**
 * 根据当前赛季状态生成下一个选择点。
 * 导演不排时间表，而是每次只给出下一个选择。
 *
 * 选择的生成逻辑：
 * - Day 1 早晨 → group_event（破冰，必须）
 * - Day 1 之后 → location_visit（去厨房？去天台？可选）
 * - 每天一次 → date_card（约会券给谁，必须）
 * - 每天深夜 → sms_target + sms_content（匿名短信，可选）
 * - 每天一次 → daily_mission（可选）
 * - 每天结束 → observatory（观察室，可选）
 *
 * 选择的触发条件基于：
 * - 当前 day + 时段
 * - 角色戏份平衡（getScreenTimeMap）
 * - 已完成的选择历史
 */
export function generateNextChoicePoint(
  season: SeasonState,
  charStates: CharacterState[],
  completedChoiceIds: string[],
): ChoicePoint {
  const { day, phase } = season;
  const period = inferPeriod(phase);


  // ── 辅助：检查某个 prefix 类型是否今天已完成 ──
  const dayPrefix = `d${day}_`;
  const hasDone = (type: string) =>
    completedChoiceIds.some((id) => id.startsWith(dayPrefix) && id.includes(type));

  // ── Day 1 破冰（最高优先级） ──
  if (day === 1 && !hasDone('group_event')) {
    return {
      id: `${dayPrefix}group_event`,
      type: 'group_event',
      prompt: '📢 节目组通知：全体嘉宾请到客厅集合，今晚是破冰之夜！',
      mandatory: true,
      consequence: '所有角色初次见面，建立第一印象',
    };
  }

  // ── 每天必须：date_card（约会券） ──
  if (!hasDone('date_card')) {
    const availableChars = season.charIds.filter(
      (id) => !season.eliminations.includes(id),
    );
    const screenTime = getScreenTimeMap(season);
    // 按戏份从少到多排序，让低戏份角色出现在前面
    const sorted = [...availableChars].sort(
      (a, b) => (screenTime.get(a) || 0) - (screenTime.get(b) || 0),
    );
    const options: ChoiceOption[] = sorted.map((id) => {
      const state = charStates.find((c) => c.characterId === id);
      return {
        id,
        label: id,
        hint: state ? `好感度 ${state.affection}` : undefined,
      };
    });

    return {
      id: `${dayPrefix}date_card`,
      type: 'date_card',
      prompt: day === 1
        ? '💌 节目组递来第一张约会邀请卡。破冰之后，你想邀请谁进行第一次 1v1 约会？'
        : '💌 你收到了一张约会券！今天你想邀请谁一起外出？',
      options,
      mandatory: true,
      consequence: '获选角色获得独处约会场景',
    };
  }

  // ── observatory：观察室（每天结束前） ──
  if (
    (phase === 'observatory' || phase === 'day_end') &&
    !hasDone('observatory')
  ) {
    const availableChars = season.charIds.filter(
      (id) => !season.eliminations.includes(id),
    );
    const options: ChoiceOption[] = availableChars.map((id) => ({
      id,
      label: id,
      hint: '查看 TA 的独白',
    }));

    return {
      id: `${dayPrefix}observatory`,
      type: 'observatory',
      prompt: '🔭 观察室开放了。你想偷看谁的独白？',
      options,
      mandatory: false,
      consequence: '可以看到该角色当天的 innerThought',
    };
  }

  // ── 深夜时段：匿名短信 ──
  if (period === 'night' && !hasDone('sms_target')) {
    const availableChars = season.charIds.filter(
      (id) => !season.eliminations.includes(id),
    );
    const options: ChoiceOption[] = availableChars.map((id) => ({
      id,
      label: id,
      hint: '匿名发送',
    }));

    return {
      id: `${dayPrefix}sms_target`,
      type: 'sms_target',
      prompt: '📱 深夜了……你可以匿名发一条短信给某个人。要发给谁？',
      options,
      mandatory: false,
      consequence: '收到短信的角色会产生对应情绪变化',
    };
  }

  // ── 已选短信目标 → 写短信内容 ──
  if (hasDone('sms_target') && !hasDone('sms_content')) {
    return {
      id: `${dayPrefix}sms_content`,
      type: 'sms_content',
      prompt: '✏️ 写点什么吧……（匿名短信，对方不会知道是谁发的）',
      freeInput: true,
      mandatory: false,
      consequence: '短信内容会影响对方的 innerThought 和 mood',
    };
  }

  // ── 每天一次：密令任务 ──
  if (!hasDone('daily_mission')) {
    return {
      id: `${dayPrefix}daily_mission`,
      type: 'daily_mission',
      prompt: '🎯 导演密令已送达。你要现在打开看看吗？',
      options: [
        { id: 'accept', label: '接受密令' },
        { id: 'reject', label: '稍后再看' },
      ],
      mandatory: false,
      consequence: '完成密令会解锁特殊角色反应',
    };
  }

  // ── location_visit：去合宿屋某个地方 ──
  if (!hasDone('location_visit')) {
    const options: ChoiceOption[] = HOUSE_LOCATIONS.map((loc) => ({
      id: loc.id,
      label: loc.name,
      hint: loc.atmosphere,
    }));

    return {
      id: `${dayPrefix}location_visit`,
      type: 'location_visit',
      prompt: '🏠 你想去哪儿逛逛？',
      options,
      mandatory: false,
      consequence: '前往该地点可能触发偶遇场景',
    };
  }

  // ── 兜底：采访间 ──
  return {
    id: `${dayPrefix}interview_${Date.now()}`,
    type: 'interview',
    prompt: '📹 导演喊你去采访间坐坐，聊聊今天的感受。',
    freeInput: true,
    mandatory: false,
    consequence: '采访内容会被记录，影响后续剧情走向',
  };
}

/**
 * 处理用户对选择点的回应，返回更新后的赛季状态。
 */
export function resolveChoice(
  season: SeasonState,
  choiceId: string,
  selectedOptionId?: string,
  _freeInputText?: string,
): SeasonState {
  // 基本的状态更新逻辑（具体副作用由调用方处理）
  let updated = { ...season, lastActiveAt: Date.now() };

  // 根据选择类型做特定处理
  if (choiceId.includes('date_card') && selectedOptionId) {
    // 约会券：没有直接的 season 变化，由场景系统处理
  }

  if (choiceId.includes('observatory')) {
    // 观察室结束 → 推进 phase
    updated = updatePhase(updated, 'day_end');
  }

  // 如果当天所有阶段已结束，标记
  if (updated.phase === 'day_end') {
    // 日结束，等 advanceDay() 调用
  }

  return updated;
}

// ═══════════════════════════════════════════════
//  3. 场景管理
// ═══════════════════════════════════════════════

/** 根据选择结果创建场景 */
export function createSceneFromChoice(
  season: SeasonState,
  choice: ChoicePoint,
  selectedOption?: string,
): LoveShowScene {
  // 确定地点
  let locationId = 'living_room';
  let locationName = '客厅';
  let atmosphere = '公开热闹，群聊破冰';

  switch (choice.type) {
    case 'group_event':
      locationId = 'living_room';
      locationName = '客厅';
      atmosphere = '全员集合，氛围热烈';
      break;

    case 'location_visit':
      if (selectedOption) {
        const loc = HOUSE_LOCATIONS.find((l) => l.id === selectedOption);
        if (loc) {
          locationId = loc.id;
          locationName = loc.name;
          atmosphere = loc.atmosphere;
        }
      }
      break;

    case 'date_card':
      if (selectedOption) {
        // 随机选择约会地点
        const dateLoc =
          DATE_LOCATION_POOL[
            Math.floor(Math.random() * DATE_LOCATION_POOL.length)
          ];
        locationId = dateLoc.id;
        locationName = dateLoc.name;
        atmosphere = dateLoc.atmosphere;
      }
      break;

    case 'interview':
      locationId = 'interview_room';
      locationName = '采访间';
      atmosphere = '独处真实，对镜头说心里话';
      break;

    case 'observatory':
      locationId = 'observatory';
      locationName = '观察室';
      atmosphere = '暗处窥探，内心翻涌';
      break;

    default:
      break;
  }

  // 确定出场角色
  let characterIds = selectSceneCharacters(
    season,
    choice.type === 'group_event' ? season.charIds.length : 3,
    undefined,
  );

  if (choice.type === 'date_card' && selectedOption) {
    characterIds = [selectedOption];
  } else if (choice.type === 'sms_target' && selectedOption && !characterIds.includes(selectedOption)) {
    characterIds = [selectedOption, ...characterIds].slice(0, 3);
  }

  return {
    id: uid('scene'),
    dayNumber: season.day,
    locationId,
    locationName,
    characterIds,
    atmosphere,
    status: 'pending',
  };
}

// ═══════════════════════════════════════════════
//  4. 角色调度
// ═══════════════════════════════════════════════

/** 计算每个角色的戏份（简易版：基于 charIds 出现频次） */
export function getScreenTimeMap(season: SeasonState): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of season.charIds) {
    // 基础戏份 = 1（注册即算 1）
    map.set(id, 1);
  }
  // 被淘汰的角色戏份归零
  for (const id of season.eliminations) {
    map.set(id, 0);
  }
  return map;
}

/** 选择场景出场角色（基于戏份平衡） */
export function selectSceneCharacters(
  season: SeasonState,
  maxCharacters: number,
  excludeIds?: string[],
): string[] {
  const excludeSet = new Set(excludeIds || []);
  const available = season.charIds.filter(
    (id) => !season.eliminations.includes(id) && !excludeSet.has(id),
  );

  if (available.length <= maxCharacters) {
    return [...available];
  }

  // 按戏份从少到多排序，优先选低戏份角色
  const screenTime = getScreenTimeMap(season);
  const sorted = [...available].sort(
    (a, b) => (screenTime.get(a) || 0) - (screenTime.get(b) || 0),
  );

  return sorted.slice(0, maxCharacters);
}

// ═══════════════════════════════════════════════
//  4.5 导演镜头卡
// ═══════════════════════════════════════════════

export interface DirectorBeatInput {
  season: SeasonState;
  scene: LoveShowScene;
  characters: DirectorBeatCharacterBrief[];
  sceneSummaries: string[];
  recentDialogue: string;
  choiceContext?: string;
}

export type DirectorBeatPlanSource = 'api' | 'fallback';

export interface DirectorBeatPlan {
  beat: DirectorBeat;
  source: DirectorBeatPlanSource;
  issues: string[];
}

export function createFallbackDirectorBeat(input: DirectorBeatInput): DirectorBeat {
  const availableIds = activeSeasonCharIds(input.season);
  const sceneIds = input.scene.characterIds.filter(id => availableIds.includes(id));
  const presentCharIds = (sceneIds.length > 0 ? sceneIds : availableIds).slice(0, 4);
  const cuedId = findCuedCharacterId(input, presentCharIds);
  const leadIndex = cuedId
    ? Math.max(0, presentCharIds.indexOf(cuedId))
    : stableIndex(
        `${input.scene.id}|${input.sceneSummaries.length}|${input.recentDialogue.length}|${input.choiceContext || ''}`,
        presentCharIds.length,
      );
  const leadId = presentCharIds[leadIndex] || input.characters[0]?.id || 'unknown';
  const secondId = presentCharIds.length > 1
    ? presentCharIds[(leadIndex + 1) % presentCharIds.length]
    : undefined;
  const speakerIds = [leadId, secondId].filter((id): id is string => Boolean(id));
  const speakers = speakerIds.slice(0, 2).map((charId, index) => ({
    charId,
    role: index === 0 ? 'lead' as const : 'respond' as const,
    intent: index === 0
      ? (cuedId === charId ? '回应用户刚刚给出的明确 cue' : '主动接住当前气氛，把话题递给用户')
      : '用一句克制回应补出多人现场感',
  }));

  return {
    beatId: uid('beat'),
    sceneType: inferDirectorSceneType(input.scene, input.season),
    presentCharIds,
    cameraFocus: [
      {
        charId: leadId,
        shotType: cuedId ? 'close_up' : (presentCharIds.length > 2 ? 'wide' : 'close_up'),
        reason: cuedId ? '用户刚刚 cue 到这位嘉宾，镜头顺势切过去' : '保底镜头，轮换一位嘉宾接住这一小拍',
      },
      ...(secondId ? [{
        charId: secondId,
        shotType: 'reaction' as const,
        reason: '给第二位嘉宾一个明确的反应机会',
      }] : []),
    ],
    speakers,
    reactionOnlyCharIds: presentCharIds.filter(id => !speakers.some(speaker => speaker.charId === id)),
    userPosition: presentCharIds.length > 1 ? 'being_addressed' : 'private_moment',
    endingMode: 'wait_user',
    userPromptHint: '轮到你回应镜头里的这一小拍。',
    directorNote: '保底调度：让多人现场稳定，停在用户可以接话的位置。',
  };
}

function fallbackDirectorBeatPlan(input: DirectorBeatInput, issue: string): DirectorBeatPlan {
  return {
    beat: createFallbackDirectorBeat(input),
    source: 'fallback',
    issues: [issue],
  };
}

export function validateDirectorBeat(raw: Partial<DirectorBeat>, input: DirectorBeatInput): DirectorBeatPlan {
  if (!raw || typeof raw !== 'object') {
    return fallbackDirectorBeatPlan(input, 'DirectorBeat is not a JSON object');
  }

  const fallback = createFallbackDirectorBeat(input);
  const activeIds = activeSeasonCharIds(input.season);
  const sceneAllowedIds = input.scene.characterIds.filter(id => activeIds.includes(id));
  const allowedPresentSet = new Set(sceneAllowedIds.length > 0 ? sceneAllowedIds : activeIds);
  const issues: string[] = [];

  const rawPresent = Array.isArray(raw.presentCharIds) ? raw.presentCharIds : [];
  const presentCharIds = rawPresent
    .filter((id): id is string => typeof id === 'string' && allowedPresentSet.has(id));
  if (!Array.isArray(raw.presentCharIds)) {
    return fallbackDirectorBeatPlan(input, 'presentCharIds is missing or not an array');
  }
  if (presentCharIds.length === 0) {
    return fallbackDirectorBeatPlan(input, 'presentCharIds has no valid season characters');
  }
  if (presentCharIds.length !== rawPresent.length) {
    issues.push('Removed presentCharIds that are not allowed in the current scene');
  }

  const safePresent = presentCharIds.slice(0, 4);
  if (presentCharIds.length > safePresent.length) {
    issues.push('Trimmed presentCharIds to 4 characters');
  }
  if (!isOneOf(raw.sceneType, DIRECTOR_SCENE_TYPES)) {
    return fallbackDirectorBeatPlan(input, 'sceneType is invalid');
  }
  if (!isOneOf(raw.endingMode, DIRECTOR_ENDING_MODES)) {
    return fallbackDirectorBeatPlan(input, 'endingMode is invalid');
  }

  const presentSet = new Set(safePresent);
  const fallbackForPresent = createFallbackDirectorBeat({
    ...input,
    scene: { ...input.scene, characterIds: safePresent },
  });

  const rawFocus = Array.isArray(raw.cameraFocus) ? raw.cameraFocus : [];
  if (!Array.isArray(raw.cameraFocus)) {
    issues.push('cameraFocus is missing or not an array; using fallback focus');
  }
  const cameraFocus = rawFocus
    .filter(item => item && typeof item === 'object')
    .map(item => item as DirectorBeat['cameraFocus'][number])
    .filter(item => {
      const valid = presentSet.has(item.charId);
      if (!valid) issues.push(`Removed cameraFocus for non-present character: ${String(item.charId)}`);
      return valid;
    })
    .slice(0, 4)
    .map(item => {
      const shotType = isOneOf(item.shotType, DIRECTOR_SHOT_TYPES) ? item.shotType : 'reaction';
      if (shotType !== item.shotType) {
        issues.push(`Repaired invalid shotType for ${item.charId}`);
      }
      return {
        charId: item.charId,
        shotType,
        reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : '镜头需要给出反应',
      };
    });

  const rawSpeakers = Array.isArray(raw.speakers) ? raw.speakers : [];
  if (!Array.isArray(raw.speakers)) {
    issues.push('speakers is missing or not an array; using fallback speakers');
  }
  if (rawSpeakers.length > 3) {
    issues.push('Trimmed speakers to 3 characters');
  }
  const speakers = rawSpeakers
    .filter(item => item && typeof item === 'object')
    .map(item => item as DirectorBeat['speakers'][number])
    .filter(item => {
      const valid = presentSet.has(item.charId);
      if (!valid) issues.push(`Removed speaker for non-present character: ${String(item.charId)}`);
      return valid;
    })
    .slice(0, 3)
    .map(item => {
      const role = isOneOf(item.role, DIRECTOR_SPEAKER_ROLES) ? item.role : 'respond';
      if (role !== item.role) {
        issues.push(`Repaired invalid speaker role for ${item.charId}`);
      }
      return {
        charId: item.charId,
        role,
        intent: typeof item.intent === 'string' && item.intent.trim() ? item.intent.trim() : '自然回应这一小拍',
      };
    });

  const speakerSet = new Set(speakers.map(speaker => speaker.charId));
  const rawReactions = Array.isArray(raw.reactionOnlyCharIds) ? raw.reactionOnlyCharIds : [];
  if (!Array.isArray(raw.reactionOnlyCharIds)) {
    issues.push('reactionOnlyCharIds is missing or not an array; inferred reaction slots');
  }
  const reactionOnlyCharIds = Array.from(new Set([
    ...rawReactions.filter((id): id is string => {
      const valid = typeof id === 'string' && presentSet.has(id) && !speakerSet.has(id);
      if (!valid) issues.push(`Removed invalid or speaking reactionOnly character: ${String(id)}`);
      return valid;
    }),
    ...safePresent.filter(id => !speakerSet.has(id)),
  ]));

  if (cameraFocus.length === 0) {
    issues.push('cameraFocus had no valid entries; using fallback focus');
  }
  if (speakers.length === 0) {
    issues.push('speakers had no valid entries; using fallback speakers');
  }

  const userPosition = isOneOf(raw.userPosition, DIRECTOR_USER_POSITIONS)
    ? raw.userPosition
    : fallback.userPosition;
  if (userPosition !== raw.userPosition) {
    issues.push('Repaired invalid userPosition');
  }

  return {
    beat: {
      beatId: typeof raw.beatId === 'string' && raw.beatId.trim() ? raw.beatId.trim() : fallback.beatId,
      sceneType: raw.sceneType,
      presentCharIds: safePresent,
      cameraFocus: cameraFocus.length > 0 ? cameraFocus : fallbackForPresent.cameraFocus,
      speakers: speakers.length > 0 ? speakers : fallbackForPresent.speakers,
      reactionOnlyCharIds,
      userPosition,
      endingMode: raw.endingMode,
      userPromptHint: typeof raw.userPromptHint === 'string' ? raw.userPromptHint : fallback.userPromptHint,
      directorNote: typeof raw.directorNote === 'string' && raw.directorNote.trim()
        ? raw.directorNote.trim()
        : fallback.directorNote,
    },
    source: 'api',
    issues,
  };
}

// ═══════════════════════════════════════════════
//  5. 副模型调用封装
// ═══════════════════════════════════════════════

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const SUB_MODEL_SYSTEM_PROMPT = '你是恋综副模型。严格遵守用户提示中的输出格式，不要添加解释。';
const SUB_MODEL_TIMEOUT_MS = 60000;

/**
 * 通用的 OpenAI 兼容 API 调用器。
 * 使用标准 fetch，不引入新 HTTP 库。
 */
async function callSubModel(
  config: ApiConfig,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.7,
  requestLabel = '副模型',
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SUB_MODEL_TIMEOUT_MS);
  let resp: Response;

  try {
    resp = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`${requestLabel} 请求超时（${Math.round(SUB_MODEL_TIMEOUT_MS / 1000)} 秒）：${url}`);
    }
    throw new Error(`${requestLabel} 请求失败：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const suffix = detail.trim() ? ` - ${detail.trim().slice(0, 400)}` : '';
    throw new Error(`${requestLabel} API error: ${resp.status} ${resp.statusText}${suffix}`);
  }

  const data = await resp.json().catch((err) => {
    throw new Error(`${requestLabel} 响应不是合法 JSON：${err instanceof Error ? err.message : String(err)}`);
  });
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * 安全地解析 JSON 响应。
 * 容忍模型在 JSON 前后加 markdown 代码块标记。
 */
function safeParseJson<T>(raw: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(raw);
  } catch {
    // 尝试提取 ```json ... ``` 包裹的内容
    const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw new Error(`Failed to parse JSON from sub-model response: ${raw.slice(0, 200)}`);
  }
}

const IMPRESSION_RISK_TERMS = [
  '危险',
  '猎物',
  '奖品',
  '战利品',
  '征服',
  '驯服',
  '拿捏',
  '心机',
  '难搞',
  '不安分',
  '很会',
  '会玩',
  '吊着',
  '勾人',
  '搅乱',
  '争夺',
  '变量',
  '破坏规则',
  '重新定义规则',
  '让人想靠近',
  '让人忍不住',
  '看不透',
  '执棋',
  '入局',
  '掌控感',
  '反客为主',
  '攻略',
  '占有',
  '被争夺',
] as const;

const SAFE_IMPRESSION_FALLBACKS = [
  '她没有急着回应，但态度很稳。',
  '她有自己的节奏，不太会被气氛推着走。',
  '她说话不重，但能把意思讲明白。',
  '相处起来比一开始轻松一点。',
];

function textLength(text: string): number {
  return Array.from(text).length;
}

function truncateText(text: string, maxLength: number): string {
  const chars = Array.from(text.trim());
  return chars.length > maxLength ? chars.slice(0, maxLength).join('') : chars.join('');
}

function hasImpressionRisk(text: string): string | null {
  return IMPRESSION_RISK_TERMS.find(term => text.includes(term)) || null;
}

function stringArrayFrom(value: unknown, fallback: string[], maxItems: number): string[] {
  const source = Array.isArray(value) ? value : fallback;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of source) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function currentTentativeReads(current: LoveShowUserImpression): string[] {
  return current.tentativeReads?.length ? current.tentativeReads : current.misconceptions || [];
}

function normalizeImpressionPayload(
  payload: Record<string, unknown>,
  current: LoveShowUserImpression,
): LoveShowUserImpression {
  const tentativeReads = stringArrayFrom(
    payload.tentativeReads ?? payload.misconceptions,
    currentTentativeReads(current),
    4,
  );
  const impression = typeof payload.impression === 'string' && payload.impression.trim()
    ? payload.impression.trim()
    : current.impression;

  return {
    ...current,
    perceivedTraits: stringArrayFrom(payload.perceivedTraits, current.perceivedTraits || [], 4),
    knownFacts: stringArrayFrom(payload.knownFacts, current.knownFacts || [], 4),
    tentativeReads,
    misconceptions: tentativeReads,
    impression,
  };
}

function collectImpressionIssues(candidate: LoveShowUserImpression): string[] {
  const issues: string[] = [];
  const checkText = (field: string, text: string) => {
    const term = hasImpressionRisk(text);
    if (term) issues.push(`${field} 含高风险表达「${term}」`);
  };

  candidate.perceivedTraits.forEach((trait, index) => {
    checkText(`perceivedTraits[${index}]`, trait);
    if (textLength(trait) > 8) issues.push(`perceivedTraits[${index}] 过长，应是 2-6 个字左右`);
  });
  candidate.knownFacts.forEach((fact, index) => {
    checkText(`knownFacts[${index}]`, fact);
    if (textLength(fact) > 18) issues.push(`knownFacts[${index}] 过长，应不超过 18 字`);
  });
  candidate.tentativeReads.forEach((read, index) => {
    checkText(`tentativeReads[${index}]`, read);
    if (textLength(read) > 36) issues.push(`tentativeReads[${index}] 过长，应具体但克制`);
  });
  checkText('impression', candidate.impression);
  if (textLength(candidate.impression) > 32) issues.push('impression 过长，应不超过 32 字');

  return issues;
}

function filterSafeImpressionItems(items: string[], maxItems: number, maxLength: number): string[] {
  return items
    .filter(item => !hasImpressionRisk(item))
    .map(item => truncateText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function createSafeImpressionFallback(
  current: LoveShowUserImpression,
  sceneSummary: string,
): LoveShowUserImpression {
  const perceivedTraits = filterSafeImpressionItems(current.perceivedTraits || [], 4, 8);
  const knownFacts = filterSafeImpressionItems(current.knownFacts || [], 4, 18);
  const tentativeReads = filterSafeImpressionItems(currentTentativeReads(current), 4, 32);
  const fallbackIndex = stableIndex(`${current.characterId}|${sceneSummary}`, SAFE_IMPRESSION_FALLBACKS.length);

  return {
    ...current,
    perceivedTraits: perceivedTraits.length > 0 ? perceivedTraits : ['有分寸'],
    knownFacts: knownFacts.length > 0 ? knownFacts : ['参与了刚才的互动'],
    tentativeReads: tentativeReads.length > 0 ? tentativeReads : ['可能还在观察气氛'],
    misconceptions: tentativeReads.length > 0 ? tentativeReads : ['可能还在观察气氛'],
    impression: SAFE_IMPRESSION_FALLBACKS[fallbackIndex],
  };
}

async function repairImpressionPayload(
  apiConfig: ApiConfig,
  charName: string,
  userName: string,
  rawOutput: string,
  issues: string[],
  currentImpression: LoveShowUserImpression,
): Promise<LoveShowUserImpression> {
  const repairPrompt = buildImpressionRepairPrompt(charName, userName, rawOutput, issues);
  const repairedRaw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, repairPrompt, 0.25, `${charName} 印象修正`);
  const repairedParsed = safeParseJson<Record<string, unknown>>(repairedRaw);
  return normalizeImpressionPayload(repairedParsed, currentImpression);
}

/** 生成下一小拍导演镜头卡（带校验元信息） */
export async function generateDirectorBeatWithMeta(
  apiConfig: ApiConfig,
  input: DirectorBeatInput,
): Promise<DirectorBeatPlan> {
  const userPrompt = buildDirectorBeatPrompt(
    input.season,
    input.scene,
    input.characters,
    input.sceneSummaries,
    input.recentDialogue,
    input.choiceContext,
  );

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.45, 'DirectorBeat');
  try {
    const parsed = safeParseJson<Partial<DirectorBeat>>(raw);
    return validateDirectorBeat(parsed, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DirectorBeat JSON parse failed';
    return fallbackDirectorBeatPlan(input, message);
  }
}

/** 生成下一小拍导演镜头卡 */
export async function generateDirectorBeat(
  apiConfig: ApiConfig,
  input: DirectorBeatInput,
): Promise<DirectorBeat> {
  const plan = await generateDirectorBeatWithMeta(apiConfig, input);
  return plan.beat;
}

/** 评估角色状态变化 */
export async function evaluateCharacterState(
  apiConfig: ApiConfig,
  charName: string,
  userName: string,
  sceneSummary: string,
  currentState: CharacterState,
): Promise<CharacterState> {
  const userPrompt = buildCharacterStateEvalPrompt(charName, userName, sceneSummary, currentState);

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.5, `${charName} 状态评估`);
  const parsed = safeParseJson<Partial<CharacterState>>(raw);

  return {
    ...currentState,
    ...parsed,
    characterId: currentState.characterId, // 不可覆盖
    lastUpdatedScene: sceneSummary.slice(0, 50),
  };
}

/** 更新印象卡 */
export async function updateImpression(
  apiConfig: ApiConfig,
  charName: string,
  userName: string,
  sceneSummary: string,
  currentImpression: LoveShowUserImpression,
): Promise<LoveShowUserImpression> {
  const userPrompt = buildImpressionUpdatePrompt(charName, userName, sceneSummary, currentImpression);

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.5, `${charName} 印象更新`);
  let candidate: LoveShowUserImpression;

  try {
    const parsed = safeParseJson<Record<string, unknown>>(raw);
    candidate = normalizeImpressionPayload(parsed, currentImpression);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      candidate = await repairImpressionPayload(
        apiConfig,
        charName,
        userName,
        raw,
        [`印象卡返回内容不是合法 JSON：${message}`],
        currentImpression,
      );
    } catch (repairErr) {
      console.warn('[LoveShow] Impression JSON repair failed; using local fallback.', repairErr);
      return createSafeImpressionFallback(currentImpression, sceneSummary);
    }
  }

  const issues = collectImpressionIssues(candidate);
  if (issues.length === 0) return candidate;

  try {
    const repaired = await repairImpressionPayload(
      apiConfig,
      charName,
      userName,
      JSON.stringify(candidate),
      issues,
      currentImpression,
    );
    const repairedIssues = collectImpressionIssues(repaired);
    if (repairedIssues.length === 0) return repaired;
    console.warn('[LoveShow] Impression repair still unsafe; using local fallback.', repairedIssues);
  } catch (err) {
    console.warn('[LoveShow] Impression repair failed; using local fallback.', err);
  }

  return createSafeImpressionFallback(currentImpression, sceneSummary);
}

/** 生成场景摘要 */
export async function generateSceneSummary(
  apiConfig: ApiConfig,
  charName: string,
  userName: string,
  rawDialogue: string,
): Promise<string> {
  const userPrompt = buildSceneSummaryPrompt(charName, userName, rawDialogue);

  return callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.4, '场景摘要');
}

/** 批量生成社交媒体帖子 */
export async function generateSocialPosts(
  apiConfig: ApiConfig,
  day: number,
  seasonSummary: string,
  charNames: string[],
  userName?: string,
): Promise<LoveShowSocialPost[]> {
  const userPrompt = buildSocialPostsPrompt(day, seasonSummary, charNames, userName);

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.8, '热搜生成');
  const parsed = safeParseJson<Record<string, unknown>[]>(raw);

  // 确保每条帖子有必填字段
  return parsed.map((post, i): LoveShowSocialPost => ({
    id: (post.id as string) || uid('post'),
    dayNumber: day,
    platform: (post.platform as LoveShowSocialPost['platform']) || 'weibo',
    username: (post.username as string) || charNames[i % charNames.length],
    content: (post.content as string) || '',
    likes: typeof post.likes === 'number' ? post.likes : undefined,
  }));
}

/** 生成 NPC 骨架 */
export async function generateNpcSkeleton(
  apiConfig: ApiConfig,
  existingCharacterSummaries: string[],
): Promise<NpcProfile> {
  const userPrompt = buildNpcGeneratorPrompt(existingCharacterSummaries);

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.9);
  const parsed = safeParseJson<Omit<NpcProfile, 'id' | 'generatedPrompt'>>(raw);

  return {
    ...parsed,
    id: `npc_${crypto.randomUUID()}`,
    name: parsed.name || 'NPC',
    age: parsed.age || 22,
    job: parsed.job || '自由职业',
    memorableDetail: parsed.memorableDetail || '',
    sampleLine: parsed.sampleLine || '',
    motivation: parsed.motivation || '',
    generatedPrompt: '', // 由 expandNpcPrompt 填充
  };
}

/** 将 NPC 骨架展开为完整 prompt */
export async function expandNpcPrompt(
  apiConfig: ApiConfig,
  skeleton: NpcProfile,
): Promise<string> {
  const userPrompt = buildNpcExpandPrompt(skeleton);

  return callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.7);
}

/** 生成导演密令 */
export async function generateDirectorMission(
  apiConfig: ApiConfig,
  day: number,
  charNames: string[],
  seasonContext: string,
): Promise<DirectorMission> {
  const userPrompt = buildDirectorMissionPrompt(day, charNames, seasonContext);

  const raw = await callSubModel(apiConfig, SUB_MODEL_SYSTEM_PROMPT, userPrompt, 0.7);
  const parsed = safeParseJson<Partial<DirectorMission>>(raw);

  return {
    id: parsed.id || uid('mission'),
    dayNumber: typeof parsed.dayNumber === 'number' ? parsed.dayNumber : day,
    description: parsed.description || '',
    reward: parsed.reward || '',
    completed: parsed.completed === true,
  };
}
