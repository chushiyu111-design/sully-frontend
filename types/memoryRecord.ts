export type MemoryRecordMode =
    | 'blind_box'
    | 'relationship_theme'
    | 'selected_memory'
    | 'char_to_user'
    | 'dream_mix';

export type MemoryRecordStatus =
    | 'draft'
    | 'monologue_ready'
    | 'music_ready'
    | 'mastering'
    | 'ready'
    | 'failed';

export type MemoryRecordAudioKind = 'monologue' | 'music' | 'master';

export interface MemoryRecordSongRequest {
    theme: string;
    mood: string;
    style: string;
    perspective: string;
    voicePreference?: string;
    extraRequirements?: string;
}

export interface MemoryRecordLyricTiming {
    sourceHash: string;
    lineTimesMs: number[];
    updatedAt: number;
}

export interface MemoryRecord {
    id: string;
    charId: string;
    charName: string;
    userName: string;
    mode: MemoryRecordMode;
    status: MemoryRecordStatus;
    title: string;
    albumName: string;
    artistName: string;
    monologueText: string;
    lyrics: string;
    musicPrompt: string;
    songRequest?: MemoryRecordSongRequest;
    lyricsOffsetMs?: number;
    lyricTiming?: MemoryRecordLyricTiming;
    lyricsConfirmedAt?: number;
    inspirationReference?: string;
    coverImageUrl?: string;
    coverGradient: string;
    seedMemoryIds: string[];
    selectedMemoryIds?: string[];
    error?: string;
    model?: string;
    fallbackUsed?: boolean;
    durationMs?: number;
    monologueAudioId?: string;
    musicAudioId?: string;
    masterAudioId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface MemoryRecordAudio {
    id: string;
    recordId: string;
    kind: MemoryRecordAudioKind;
    blob: Blob;
    mimeType: string;
    durationMs?: number;
    createdAt: number;
}

export interface SerializedMemoryRecordAudio extends Omit<MemoryRecordAudio, 'blob'> {
    dataUrl?: string;
}

export const MEMORY_RECORD_MODE_LABELS: Record<MemoryRecordMode, string> = {
    blind_box: '暗格唱片',
    relationship_theme: '整段关系',
    selected_memory: '亲手封存',
    char_to_user: '他写给你',
    dream_mix: '梦境混音',
};

export const MEMORY_RECORD_STATUS_LABELS: Record<MemoryRecordStatus, string> = {
    draft: '内页已写好',
    monologue_ready: '他的独白已落下',
    music_ready: '旋律已成形',
    mastering: '正在压制',
    ready: '可以播放',
    failed: '待重压',
};
