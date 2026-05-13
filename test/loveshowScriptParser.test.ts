import { describe, expect, it } from 'vitest';
import {
  hasLoveShowFormat,
  parseLoveShowScript,
  stripQuotes,
} from '../utils/loveshowScriptParser';

describe('loveshowScriptParser', () => {
  it('parses starred narration', () => {
    const parsed = parseLoveShowScript('*厨房里有煎蛋的香气。*');

    expect(parsed.nodes).toEqual([
      { type: 'narration', content: '厨房里有煎蛋的香气。' },
    ]);
    expect(parsed.detectedCharacters).toEqual([]);
    expect(hasLoveShowFormat('*厨房里有煎蛋的香气。*')).toBe(true);
  });

  it('parses dialogue and detected characters', () => {
    const parsed = parseLoveShowScript('阿昊：「早啊。给你留了杯咖啡。」');

    expect(parsed.nodes).toEqual([
      { type: 'dialogue', character: '阿昊', content: '早啊。给你留了杯咖啡。' },
    ]);
    expect(parsed.detectedCharacters).toEqual(['阿昊']);
  });

  it('parses interview and phone notification formats', () => {
    expect(parseLoveShowScript('📹 阿昊：她选了小野，说不失落是假的。').nodes).toEqual([
      { type: 'interview', character: '阿昊', content: '她选了小野，说不失落是假的。' },
    ]);

    expect(parseLoveShowScript('📱 节目组：今晚每人一条匿名短信额度。').nodes).toEqual([
      { type: 'phone', content: '节目组：今晚每人一条匿名短信额度。' },
    ]);
  });

  it('parses inline narration followed by dialogue', () => {
    const parsed = parseLoveShowScript('*他低头笑了一下。*阿昊：「那我们走吧。」');

    expect(parsed.nodes).toEqual([
      { type: 'narration', content: '他低头笑了一下。' },
      { type: 'dialogue', character: '阿昊', content: '那我们走吧。' },
    ]);
    expect(parsed.detectedCharacters).toEqual(['阿昊']);
  });

  it('keeps ordinary text as text', () => {
    const parsed = parseLoveShowScript('今天阳光很好，但没有固定格式。');

    expect(parsed.nodes).toEqual([
      { type: 'text', content: '今天阳光很好，但没有固定格式。' },
    ]);
    expect(hasLoveShowFormat('今天阳光很好，但没有固定格式。')).toBe(false);
  });

  it('strips common paired quotes', () => {
    expect(stripQuotes('「你好」')).toBe('你好');
    expect(stripQuotes('“你好”')).toBe('你好');
    expect(stripQuotes('没有引号')).toBe('没有引号');
  });
});
