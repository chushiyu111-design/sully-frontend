import type { CharacterProfile,TtsConfig } from '../types';

type CharacterVoiceSource = Pick<CharacterProfile, 'ttsVoiceId'> | null | undefined;

export function resolveCharacterVoiceId(char: CharacterVoiceSource, config: TtsConfig): string {
    const characterVoiceId = char?.ttsVoiceId?.trim();
    if (characterVoiceId) return characterVoiceId;
    return config.voiceSetting.voice_id?.trim() || '';
}

export function withCharacterTtsVoice(config: TtsConfig, char: CharacterVoiceSource): TtsConfig {
    return {
        ...config,
        voiceSetting: {
            ...config.voiceSetting,
            voice_id: resolveCharacterVoiceId(char, config),
        },
    };
}

export function getCharacterVoiceIdNotExistMessage(voiceId: string): string {
    return `MiniMax 找不到角色声线「${voiceId || '未填写'}」（voice id not exist）。请在神经链接里换成可用的 Voice ID；如果你想改用全局兜底声线，请清空该角色 Voice ID。`;
}

export function isVoiceIdNotExistError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /voice id not exist/i.test(message) || /错误\s*2054|2054/.test(message);
}

export function toCharacterVoiceIdError(error: unknown, voiceId: string): Error {
    if (isVoiceIdNotExistError(error)) {
        return new Error(getCharacterVoiceIdNotExistMessage(voiceId));
    }
    return error instanceof Error ? error : new Error(String(error));
}
