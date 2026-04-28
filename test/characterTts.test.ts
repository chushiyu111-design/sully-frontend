import { describe,expect,it } from 'vitest';
import { DEFAULT_TTS_CONFIG,type CharacterProfile,type TtsConfig } from '../types';
import { resolveCharacterVoiceId,withCharacterTtsVoice } from '../utils/characterTts';
import { buildVoiceCallTtsConfig } from '../apps/voicecall/useVoiceCallEngine';

function buildTtsConfig(voiceId = 'global-voice'): TtsConfig {
    return {
        ...DEFAULT_TTS_CONFIG,
        voiceSetting: {
            ...DEFAULT_TTS_CONFIG.voiceSetting,
            voice_id: voiceId,
        },
    };
}

function buildChar(ttsVoiceId?: string): CharacterProfile {
    return {
        id: 'char-test',
        name: 'Test',
        avatar: '',
        description: '',
        systemPrompt: '',
        memories: [],
        ttsVoiceId,
    } as CharacterProfile;
}

describe('character TTS voice binding', () => {
    it('uses the character voice id before the global fallback', () => {
        const config = buildTtsConfig('global-voice');
        const char = buildChar('  character-voice  ');

        expect(resolveCharacterVoiceId(char, config)).toBe('character-voice');
        expect(withCharacterTtsVoice(config, char).voiceSetting.voice_id).toBe('character-voice');
    });

    it('falls back to the global voice id when the character has none', () => {
        const config = buildTtsConfig('  global-voice  ');

        expect(resolveCharacterVoiceId(buildChar(), config)).toBe('global-voice');
        expect(resolveCharacterVoiceId(buildChar('   '), config)).toBe('global-voice');
    });

    it('does not mutate the original TTS config', () => {
        const config = buildTtsConfig('global-voice');
        const merged = withCharacterTtsVoice(config, buildChar('character-voice'));

        expect(merged).not.toBe(config);
        expect(merged.voiceSetting).not.toBe(config.voiceSetting);
        expect(config.voiceSetting.voice_id).toBe('global-voice');
    });

    it('keeps the character voice id when preparing voice-call PCM config', () => {
        const config = withCharacterTtsVoice(buildTtsConfig('global-voice'), buildChar('character-voice'));
        const voiceCallConfig = buildVoiceCallTtsConfig(config);

        expect(voiceCallConfig.voiceSetting.voice_id).toBe('character-voice');
        expect(voiceCallConfig.audioSetting.format).toBe('pcm');
        expect(voiceCallConfig.audioSetting.audio_sample_rate).toBe(24000);
    });
});
