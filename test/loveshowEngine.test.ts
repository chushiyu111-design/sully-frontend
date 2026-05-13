import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceDay,
  createSceneFromChoice,
  createSeason,
  evaluateCharacterState,
  expandNpcPrompt,
  generateDirectorMission,
  generateNextChoicePoint,
  generateNpcSkeleton,
  generateSceneSummary,
  generateSocialPosts,
  updateImpression,
  updatePhase,
  type ApiConfig,
} from '../utils/loveshowEngine';
import type {
  CharacterState,
  ChoicePoint,
  LoveShowUserImpression,
  NpcProfile,
  SeasonState,
} from '../types/loveshow';

const apiConfig: ApiConfig = {
  baseUrl: 'https://sub-api.example.com',
  apiKey: 'test-key',
  model: 'sub-model',
};

function makeSeason(overrides: Partial<SeasonState> = {}): SeasonState {
  return {
    seasonId: 'season-a',
    charIds: ['char-a', 'char-b', 'char-c'],
    day: 1,
    phase: 'casting',
    eliminations: [],
    finalChoice: null,
    startedAt: 100,
    lastActiveAt: 200,
    ...overrides,
  };
}

function makeState(characterId = 'char-a'): CharacterState {
  return {
    characterId,
    affection: 20,
    mood: '期待',
    confidence: 50,
    strategy: '观望',
    jealousyTarget: null,
    innerThought: '刚开始认识。',
    lastUpdatedScene: '',
  };
}

function makeImpression(characterId = 'char-a'): LoveShowUserImpression {
  return {
    characterId,
    perceivedTraits: [],
    knownFacts: [],
    misconceptions: [],
    impression: '',
    history: [],
  };
}

function mockSubModel(content: string) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  };
}

describe('loveshowEngine', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'uuid-test',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and advances season lifecycle state', () => {
    const season = createSeason(['char-a', 'char-b']);
    const day2 = advanceDay(season);
    const phoneTime = updatePhase(day2, 'phone_time');

    expect(season.day).toBe(1);
    expect(season.phase).toBe('casting');
    expect(day2.day).toBe(2);
    expect(day2.phase).toBe('day_active');
    expect(phoneTime.phase).toBe('phone_time');
  });

  it('generates deterministic day choice points from completed ids', () => {
    const states = [makeState('char-a'), { ...makeState('char-b'), affection: 45 }];

    expect(generateNextChoicePoint(makeSeason(), states, []).type).toBe('group_event');
    expect(generateNextChoicePoint(makeSeason(), states, ['d1_group_event']).type).toBe('date_card');
    expect(generateNextChoicePoint(
      makeSeason({ phase: 'phone_time' }),
      states,
      ['d1_group_event', 'd1_date_card'],
    ).type).toBe('sms_target');
    expect(generateNextChoicePoint(
      makeSeason({ phase: 'phone_time' }),
      states,
      ['d1_group_event', 'd1_date_card', 'd1_sms_target'],
    ).type).toBe('sms_content');
    expect(generateNextChoicePoint(
      makeSeason({ phase: 'phone_time' }),
      states,
      ['d1_group_event', 'd1_date_card', 'd1_sms_target', 'd1_sms_content'],
    ).type).toBe('daily_mission');
    expect(generateNextChoicePoint(
      makeSeason(),
      states,
      ['d1_group_event', 'd1_date_card', 'd1_daily_mission'],
    ).type).toBe('location_visit');
    expect(generateNextChoicePoint(
      makeSeason({ phase: 'observatory' }),
      states,
      ['d1_group_event', 'd1_date_card', 'd1_daily_mission', 'd1_location_visit'],
    ).type).toBe('observatory');
  });

  it('creates one-on-one date card scenes', () => {
    const choice: ChoicePoint = {
      id: 'd1_date_card',
      type: 'date_card',
      prompt: '约会券给谁？',
      mandatory: true,
    };

    const scene = createSceneFromChoice(makeSeason(), choice, 'char-b');

    expect(scene.characterIds).toEqual(['char-b']);
    expect(scene.status).toBe('pending');
  });

  it('uses the character-state prompt builder in sub-model calls', async () => {
    const fetchMock = mockSubModel('{"affection": 25, "mood": "心动", "confidence": 55, "strategy": "主动进攻", "jealousyTarget": null, "innerThought": "她很特别。"}');

    const result = await evaluateCharacterState(apiConfig, '阿昊', '糯米', '厨房聊天', makeState('char-a'));
    const body = lastRequestBody(fetchMock);

    expect(result).toMatchObject({ characterId: 'char-a', affection: 25, mood: '心动' });
    expect(body.messages[1].content).toContain('心理分析师');
    expect(body.messages[1].content).toContain('厨房聊天');
  });

  it('uses the impression prompt builder and protects characterId', async () => {
    const fetchMock = mockSubModel('{"characterId": "evil", "perceivedTraits": ["温柔"], "knownFacts": ["喜欢咖啡"], "misconceptions": [], "impression": "更近了一点"}');

    const result = await updateImpression(apiConfig, '阿昊', '糯米', '厨房聊天', makeImpression('char-a'));
    const body = lastRequestBody(fetchMock);

    expect(result.characterId).toBe('char-a');
    expect(result.perceivedTraits).toEqual(['温柔']);
    expect(body.messages[1].content).toContain('心理观察员');
  });

  it('uses prompt builders for summary, social posts, npc, and missions', async () => {
    let fetchMock = mockSubModel('阿昊在厨房给糯米留咖啡，气氛变得温暖');
    await expect(generateSceneSummary(apiConfig, '阿昊', '糯米', '阿昊：「早。」')).resolves.toContain('咖啡');
    expect(lastRequestBody(fetchMock).messages[1].content).toContain('字幕编辑');

    fetchMock = mockSubModel('[{"platform":"weibo","username":"嗑糖日记","content":"她选了小野！"}]');
    await expect(generateSocialPosts(apiConfig, 2, '她选了小野', ['阿昊', '小野'])).resolves.toMatchObject([
      { platform: 'weibo', username: '嗑糖日记', dayNumber: 2 },
    ]);
    expect(lastRequestBody(fetchMock).messages[1].content).toContain('社交媒体内容模拟器');

    fetchMock = mockSubModel('{"name":"小野","age":27,"job":"摄影师","memorableDetail":"总把相机背在左肩","sampleLine":"我先看看光。","motivation":"朋友替他报了名"}');
    await expect(generateNpcSkeleton(apiConfig, ['阿昊，咖啡店主'])).resolves.toMatchObject({
      id: 'npc_uuid-test',
      name: '小野',
    });
    expect(lastRequestBody(fetchMock).messages[1].content).toContain('你需要提供四件事');

    const skeleton: NpcProfile = {
      id: 'npc-a',
      name: '小野',
      age: 27,
      job: '摄影师',
      memorableDetail: '总把相机背在左肩',
      sampleLine: '我先看看光。',
      motivation: '朋友替他报了名',
      generatedPrompt: '',
    };
    fetchMock = mockSubModel('完整人设 prompt');
    await expect(expandNpcPrompt(apiConfig, skeleton)).resolves.toBe('完整人设 prompt');
    expect(lastRequestBody(fetchMock).messages[1].content).toContain('编剧');

    fetchMock = mockSubModel('{"description":"安慰阿昊","reward":"隐藏档案"}');
    await expect(generateDirectorMission(apiConfig, 2, ['阿昊'], '阿昊有点失落')).resolves.toMatchObject({
      dayNumber: 2,
      description: '安慰阿昊',
      reward: '隐藏档案',
      completed: false,
    });
    expect(lastRequestBody(fetchMock).messages[1].content).toContain('导演组成员');
  });
});
