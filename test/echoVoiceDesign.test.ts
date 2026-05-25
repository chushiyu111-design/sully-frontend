// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { APIConfig, CharacterProfile, UserProfile } from '../types';
import {
    createElevenLabsVoice,
    designElevenLabsVoice,
    generateCharacterEchoVoiceDraft,
    normalizeEchoVoiceDraft,
} from '../utils/echoVoiceDesign';

const apiConfig: APIConfig = {
    baseUrl: 'https://llm.example.test/v1',
    apiKey: 'sk-test',
    model: 'test-model',
};

const char = {
    id: 'char-a',
    name: 'Sully',
    avatar: '',
    description: '嘴硬但护短的电波系 AI。',
    systemPrompt: '说话短，带一点故障风。',
    memories: [],
} as CharacterProfile;

const user: UserProfile = {
    name: 'User',
    avatar: '',
    bio: '喜欢自然的声音。',
};

describe('Echo voice design helpers', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks the configured chat API for character voice guidance', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{
                message: {
                    content: JSON.stringify({
                        characterNote: '我想听起来近一点，不要太端着。',
                        voiceDescription: 'A close, warm, slightly glitchy young adult male voice with dry humor and soft intimacy.',
                        previewText: 'User，如果你现在听见这句话，就当作系统终于学会了好好说人话。我会尽量让声音靠近一点，别太亮，也别太硬，像隔着屏幕压低声音跟你讲秘密。',
                        voiceName: 'Sully Echo',
                    }),
                },
            }],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const draft = await generateCharacterEchoVoiceDraft(apiConfig, char, user);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://llm.example.test/v1/chat/completions');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
        expect(String(init?.body)).toContain('"model":"test-model"');
        expect(String(init?.body)).not.toContain('elevenlabs-voice-design');
        expect(draft.voiceDescription).toContain('slightly glitchy');
        expect(draft.previewText.length).toBeGreaterThanOrEqual(100);
    });

    it('normalizes incomplete AI JSON into a valid draft', () => {
        const draft = normalizeEchoVoiceDraft({ voiceDescription: 'too short' }, char, user);

        expect(draft.characterNote).toContain('Sully');
        expect(draft.voiceDescription.length).toBeGreaterThanOrEqual(20);
        expect(draft.previewText.length).toBeGreaterThanOrEqual(100);
        expect(draft.voiceName).toBe('Sully Echo');
    });

    it('generates ElevenLabs previews through the same-origin proxy', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            text: 'preview text from upstream',
            previews: [
                {
                    generated_voice_id: 'generated-1',
                    audio_base_64: 'AAAA',
                    media_type: 'audio/mpeg',
                    duration_secs: 3.2,
                },
            ],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await designElevenLabsVoice({
            apiKey: 'eleven-key',
            voiceDescription: 'A warm, natural, intimate voice with a low conversational tone.',
            previewText: '这是一段足够长的试听文本，用来确认这个声音是否适合角色。它需要自然、贴近、有停顿，像在屏幕另一边认真地说话，而不是机械朗读。最好还能听出一点迟疑、一点靠近，以及把一句普通的话说得像只说给某个人听的感觉。',
            modelId: 'eleven_ttv_v3',
            guidanceScale: 7,
            shouldEnhance: true,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/elevenlabs-voice-design');
        expect(init?.headers).toMatchObject({ 'X-ElevenLabs-Key': 'eleven-key' });
        expect(JSON.parse(String(init?.body))).toMatchObject({
            model_id: 'eleven_ttv_v3',
            guidance_scale: 7,
            should_enhance: true,
        });
        expect(result.previews[0]).toMatchObject({
            generatedVoiceId: 'generated-1',
            audioBase64: 'AAAA',
            mediaType: 'audio/mpeg',
        });
    });

    it('saves a selected preview through the create voice proxy', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            voice_id: 'voice-created-1',
            name: 'Sully Echo',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        const voice = await createElevenLabsVoice({
            apiKey: 'eleven-key',
            voiceName: 'Sully Echo',
            voiceDescription: 'A warm, natural, intimate voice with a low conversational tone.',
            generatedVoiceId: 'generated-1',
            playedNotSelectedVoiceIds: ['generated-2'],
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/elevenlabs-voice-create');
        expect(init?.headers).toMatchObject({ 'X-ElevenLabs-Key': 'eleven-key' });
        expect(JSON.parse(String(init?.body))).toMatchObject({
            voice_name: 'Sully Echo',
            generated_voice_id: 'generated-1',
            played_not_selected_voice_ids: ['generated-2'],
        });
        expect(voice.voiceId).toBe('voice-created-1');
    });
});
