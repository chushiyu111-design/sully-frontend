import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialCharacterState,
  createInitialImpression,
  deleteSeason,
  getActiveSeason,
  getAllCharacterStates,
  getAllImpressions,
  getAllSeasons,
  getCharacterState,
  getImpression,
  getMemoryCards,
  getMissions,
  getNpcs,
  getSeason,
  getSocialPosts,
  saveCharacterState,
  saveImpression,
  saveMemoryCard,
  saveMissions,
  saveNpcs,
  saveSeason,
  saveSocialPosts,
  setActiveSeasonId,
} from '../utils/db/loveshowStore';
import type { LoveShowSocialPost, MemoryCard, NpcProfile, SeasonState } from '../types/loveshow';

function makeSeason(): SeasonState {
  return {
    seasonId: 'season-test',
    charIds: ['char-a', 'char-b'],
    day: 1,
    phase: 'casting',
    eliminations: [],
    finalChoice: null,
    startedAt: 100,
    lastActiveAt: 200,
  };
}

describe('loveshowStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists season state and active season index', () => {
    const season = makeSeason();

    saveSeason(season);
    setActiveSeasonId(season.seasonId);

    expect(getSeason(season.seasonId)).toEqual(season);
    expect(getActiveSeason()).toEqual(season);
    expect(getAllSeasons()).toEqual([season]);
  });

  it('persists character states and impressions', () => {
    const season = makeSeason();
    const state = { ...createInitialCharacterState('char-a'), affection: 35, mood: '心动' as const };
    const impression = {
      ...createInitialImpression('char-a'),
      perceivedTraits: ['温柔'],
      knownFacts: ['喜欢咖啡'],
      impression: '有点心动',
    };

    saveSeason(season);
    saveCharacterState(season.seasonId, state);
    saveImpression(season.seasonId, impression);

    expect(getCharacterState(season.seasonId, 'char-a')).toEqual(state);
    expect(getAllCharacterStates(season.seasonId)).toEqual([state]);
    expect(getImpression(season.seasonId, 'char-a')).toEqual(impression);
    expect(getAllImpressions(season.seasonId)).toEqual([impression]);
  });

  it('persists npcs, social posts, missions, and memories', () => {
    const season = makeSeason();
    const npcs: NpcProfile[] = [{
      id: 'npc-a',
      name: '小野',
      age: 27,
      job: '摄影师',
      memorableDetail: '总把相机背在左肩',
      sampleLine: '我先看看光。',
      motivation: '朋友替他报了名',
      generatedPrompt: '完整人设',
    }];
    const posts: LoveShowSocialPost[] = [{
      id: 'post-a',
      platform: 'weibo',
      username: '嗑糖日记',
      content: '她选了小野！',
      dayNumber: 1,
    }];
    const memory: MemoryCard = {
      sceneId: 'scene-a',
      dayNumber: 1,
      description: '厨房晨光里的一杯咖啡',
      characters: ['char-a'],
      timestamp: 300,
    };

    saveSeason(season);
    saveNpcs(season.seasonId, npcs);
    saveSocialPosts(season.seasonId, 1, posts);
    saveMissions(season.seasonId, [{
      id: 'mission-a',
      dayNumber: 1,
      description: '安慰阿昊',
      reward: '隐藏档案',
      completed: false,
    }]);
    saveMemoryCard(season.seasonId, memory);

    expect(getNpcs(season.seasonId)).toEqual(npcs);
    expect(getSocialPosts(season.seasonId, 1)).toEqual(posts);
    expect(getMissions(season.seasonId)).toHaveLength(1);
    expect(getMemoryCards(season.seasonId)).toEqual([memory]);
  });

  it('deletes a season without leaving per-character data behind', () => {
    const season = makeSeason();

    saveSeason(season);
    setActiveSeasonId(season.seasonId);
    saveCharacterState(season.seasonId, createInitialCharacterState('char-a'));
    saveImpression(season.seasonId, createInitialImpression('char-a'));
    saveSocialPosts(season.seasonId, 1, [{
      id: 'post-a',
      platform: 'xhs',
      username: '围观群众',
      content: '好看',
      dayNumber: 1,
    }]);
    saveMissions(season.seasonId, [{
      id: 'mission-a',
      dayNumber: 1,
      description: '找机会独处',
      reward: '一次观察室机会',
      completed: false,
    }]);
    saveMemoryCard(season.seasonId, {
      sceneId: 'scene-a',
      dayNumber: 1,
      description: '天台夜风',
      characters: ['char-a'],
      timestamp: 400,
    });

    deleteSeason(season.seasonId);

    expect(getSeason(season.seasonId)).toBeNull();
    expect(getActiveSeason()).toBeNull();
    expect(getAllSeasons()).toEqual([]);
    expect(getCharacterState(season.seasonId, 'char-a')).toBeNull();
    expect(getImpression(season.seasonId, 'char-a')).toBeNull();
    expect(getSocialPosts(season.seasonId, 1)).toEqual([]);
    expect(getMissions(season.seasonId)).toEqual([]);
    expect(getMemoryCards(season.seasonId)).toEqual([]);
  });
});
