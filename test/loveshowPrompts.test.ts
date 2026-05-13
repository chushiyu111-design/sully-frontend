import { describe, expect, it } from 'vitest';
import {
  buildCharacterStateEvalPrompt,
  buildDirectorMissionPrompt,
  buildImpressionUpdatePrompt,
  buildLoveShowPreamble,
  buildNpcExpandPrompt,
  buildNpcGeneratorPrompt,
  buildSceneSummaryPrompt,
  buildSocialPostsPrompt,
} from '../utils/loveshowPrompts';
import type { CharacterState, LoveShowUserImpression, NpcProfile, SeasonState } from '../types/loveshow';

const season: SeasonState = {
  seasonId: 'season-a',
  charIds: ['char-a'],
  day: 2,
  phase: 'day_active',
  eliminations: [],
  finalChoice: null,
  startedAt: 100,
  lastActiveAt: 200,
};

const charState: CharacterState = {
  characterId: 'char-a',
  affection: 42,
  mood: '心动',
  confidence: 60,
  strategy: '主动进攻',
  jealousyTarget: null,
  innerThought: '她刚才看我的眼神有点不一样。',
  lastUpdatedScene: '厨房',
};

const impression: LoveShowUserImpression = {
  characterId: 'char-a',
  perceivedTraits: ['温柔'],
  knownFacts: ['喜欢咖啡'],
  misconceptions: ['可能对所有人都这么温柔'],
  impression: '挺有意思但还看不透',
  history: [],
};

describe('loveshowPrompts', () => {
  it('builds a natural main-model preamble without frontend markup instructions', () => {
    const prompt = buildLoveShowPreamble('阿昊', '糯米', season, charState, impression);

    expect(prompt).toContain('你是阿昊，正在参加一档恋爱综艺节目');
    expect(prompt).toContain('用星号包裹动作和环境描写');
    expect(prompt).toContain('角色对话用「角色名：对话」格式');
    expect(prompt).not.toMatch(/XML|HTML|markdown/i);
  });

  it('asks the sub-model for strict JSON state and impression updates', () => {
    const statePrompt = buildCharacterStateEvalPrompt('阿昊', '糯米', '两人在厨房聊天', charState);
    const impressionPrompt = buildImpressionUpdatePrompt('阿昊', '糯米', '两人在厨房聊天', impression);

    expect(statePrompt).toContain('直接输出 JSON');
    expect(statePrompt).toContain('"affection"');
    expect(statePrompt).toContain('mood 只能从以下选择');
    expect(impressionPrompt).toContain('直接输出 JSON');
    expect(impressionPrompt).toContain('"perceivedTraits"');
    expect(impressionPrompt).toContain('同一个人在不同人眼里是完全不同的形象');
  });

  it('keeps scene summary output as plain text', () => {
    const prompt = buildSceneSummaryPrompt('阿昊', '糯米', '阿昊：「早。」');

    expect(prompt).toContain('字幕编辑');
    expect(prompt).toContain('20-30 个字');
    expect(prompt).toContain('直接输出一句话');
  });

  it('uses the four-part, two-step npc generation shape', () => {
    const generatorPrompt = buildNpcGeneratorPrompt(['阿昊，咖啡店主']);
    const skeleton: Pick<NpcProfile, 'name' | 'age' | 'job' | 'memorableDetail' | 'sampleLine' | 'motivation'> = {
      name: '小野',
      age: 27,
      job: '摄影师',
      memorableDetail: '总把相机背在左肩',
      sampleLine: '我先看看光。',
      motivation: '朋友替他报了名',
    };
    const expandPrompt = buildNpcExpandPrompt(skeleton);

    expect(generatorPrompt).toContain('你需要提供四件事');
    expect(generatorPrompt).toContain('和以上角色形成明显差异');
    expect(generatorPrompt).toContain('直接输出 JSON');
    expect(expandPrompt).toContain('角色的 system prompt');
    expect(expandPrompt).toContain('300-500 字');
  });

  it('builds social post and director mission JSON prompts', () => {
    const socialPrompt = buildSocialPostsPrompt(2, '她选了小野', ['阿昊', '小野']);
    const missionPrompt = buildDirectorMissionPrompt(2, ['阿昊', '小野'], '阿昊有点失落');

    expect(socialPrompt).toContain('社交媒体内容模拟器');
    expect(socialPrompt).toContain('生成 4-6 条');
    expect(socialPrompt).toContain('直接输出 JSON 数组');
    expect(missionPrompt).toContain('导演组成员');
    expect(missionPrompt).toContain('直接输出 JSON');
    expect(missionPrompt).toContain('"description"');
  });
});
