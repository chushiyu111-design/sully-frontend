import { buildBackendAuthQuery, buildBackendHeaders, buildBackendUrl, buildBackendUrlObject } from './backendClient';
import { safeResponseJson } from './safeApi';
import type {
    NeteaseAlbum,
    NeteaseArtist,
    NeteaseLyric,
    NeteasePlaylist,
    NeteasePlaylistCreator,
    NeteaseSearchResult,
    NeteaseSong,
    NeteaseSongUrl,
    NeteaseUserAccount,
} from '../types/music';

const COOKIE_KEY = 'netease_music_cookie';
const NETEASE_DETAIL_PROXY_PATH = '/netease-api/song-detail';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : null;
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeUrl(value: unknown): string {
    const url = readString(value);
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
}

function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
            const parsed = Number(trimmed);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return null;
}

function extractErrorMessage(value: unknown, fallback: string): string {
    const record = asRecord(value);
    if (!record) return fallback;

    const parts = [
        readString(record.error),
        readString(record.detail),
        readString(record.message),
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : fallback;
}

function assertMusicApiSuccess(value: unknown, fallback: string): void {
    const record = asRecord(value);
    if (!record) return;

    const code = readNumber(record.code);
    const nested = asRecord(record.data);
    const verifyUrl = readString(nested?.verifyUrl) || readString(nested?.url);
    const message = extractErrorMessage(record, fallback);

    if (verifyUrl || (code !== null && code < 0)) {
        throw new Error(verifyUrl ? `${message} | 网易云触发了验证` : message);
    }
}

function normalizeArtist(value: unknown): NeteaseArtist | null {
    const record = asRecord(value);
    if (!record) return null;

    const name = readString(record.name);
    const id = readNumber(record.id) ?? 0;
    if (!name) return null;

    return { id, name };
}

function normalizeAlbum(value: unknown): NeteaseAlbum | null {
    const record = asRecord(value);
    if (!record) return null;

    const name = readString(record.name);
    if (!name) return null;

    const album: NeteaseAlbum = {
        id: readNumber(record.id) ?? 0,
        name,
    };

    const picUrl = normalizeUrl(record.picUrl);
    if (picUrl) {
        album.picUrl = picUrl;
    }

    return album;
}

function normalizeSong(value: unknown): NeteaseSong | null {
    const record = asRecord(value);
    if (!record) return null;

    const id = readNumber(record.id) ?? 0;
    const name = readString(record.name);
    if (id <= 0 || !name) return null;

    const artistSource = Array.isArray(record.artists)
        ? record.artists
        : Array.isArray(record.ar)
            ? record.ar
            : [];
    const artists = artistSource
        .map(normalizeArtist)
        .filter((artist): artist is NeteaseArtist => Boolean(artist));

    const album = normalizeAlbum(record.album) || normalizeAlbum(record.al) || {
        id: 0,
        name: '',
    };

    return {
        id,
        name,
        artists,
        album,
        duration: readNumber(record.duration) ?? readNumber(record.dt) ?? 0,
    };
}

function mergeSongAlbumCover(source: NeteaseSong, detail?: NeteaseSong): NeteaseSong {
    const detailPicUrl = detail?.album.picUrl?.trim();
    if (!detailPicUrl || source.album.picUrl?.trim()) {
        return source;
    }

    return {
        ...source,
        album: {
            ...source.album,
            picUrl: detailPicUrl,
        },
    };
}

async function enrichSongsWithAlbumCovers(songs: NeteaseSong[]): Promise<NeteaseSong[]> {
    const missingCoverIds = Array.from(new Set(
        songs
            .filter((song) => !song.album.picUrl?.trim())
            .map((song) => song.id)
            .filter((id) => id > 0),
    ));

    if (missingCoverIds.length === 0) {
        return songs;
    }

    for (const fetchDetail of [
        () => sameOriginPost<{ songs?: unknown }>(NETEASE_DETAIL_PROXY_PATH, { ids: missingCoverIds }),
        () => musicPost<{ songs?: unknown }>('/api/music/song/detail', { ids: missingCoverIds }),
    ]) {
        try {
            const detailResponse = await fetchDetail();
            assertMusicApiSuccess(detailResponse, '网易云歌曲详情暂时不可用');

            const detailMap = new Map(
                (Array.isArray(detailResponse.songs) ? detailResponse.songs : [])
                    .map(normalizeSong)
                    .filter((song): song is NeteaseSong => Boolean(song))
                    .map((song) => [song.id, song] as const),
            );

            return songs.map((song) => mergeSongAlbumCover(song, detailMap.get(song.id)));
        } catch {
            // Try the next detail source.
        }
    }

    return songs;
}

function normalizeSongUrl(value: unknown): NeteaseSongUrl | null {
    const record = asRecord(value);
    if (!record) return null;

    const id = readNumber(record.id) ?? 0;
    if (id <= 0) return null;

    return {
        id,
        url: typeof record.url === 'string' ? record.url : null,
        br: readNumber(record.br) ?? 0,
        size: readNumber(record.size) ?? 0,
        type: readString(record.type),
    };
}

function normalizePlaylistCreator(value: unknown): NeteasePlaylistCreator | undefined {
    const record = asRecord(value);
    if (!record) return undefined;

    const nickname = readString(record.nickname);
    if (!nickname) return undefined;

    return {
        userId: readNumber(record.userId) ?? 0,
        nickname,
        avatarUrl: normalizeUrl(record.avatarUrl),
    };
}

function normalizePlaylist(value: unknown): NeteasePlaylist | null {
    const record = asRecord(value);
    if (!record) return null;

    const id = readNumber(record.id) ?? 0;
    const name = readString(record.name);
    if (id <= 0 || !name) return null;

    const playlist: NeteasePlaylist = {
        id,
        name,
        coverImgUrl: normalizeUrl(record.coverImgUrl),
        trackCount: readNumber(record.trackCount) ?? 0,
    };

    if (Array.isArray(record.tracks)) {
        playlist.tracks = record.tracks
            .map(normalizeSong)
            .filter((song): song is NeteaseSong => Boolean(song));
    }

    const creator = normalizePlaylistCreator(record.creator);
    if (creator) {
        playlist.creator = creator;
    }

    return playlist;
}

function normalizeUserAccount(value: unknown): NeteaseUserAccount | null {
    const record = asRecord(value);
    if (!record) return null;

    const profile = asRecord(record.profile);
    const account = asRecord(record.account);
    if (!profile) return null;

    const nickname = readString(profile.nickname);
    const userId = readNumber(profile.userId) ?? readNumber(account?.id) ?? 0;
    if (!nickname || userId <= 0) return null;

    const vipType = readNumber(profile.vipType) ?? readNumber(account?.vipType) ?? 0;
    const vipLevel = readNumber(profile.redVipLevel)
        ?? readNumber(profile.vipLevel)
        ?? readNumber(account?.redVipLevel)
        ?? 0;

    return {
        userId,
        nickname,
        avatarUrl: normalizeUrl(profile.avatarUrl),
        backgroundUrl: normalizeUrl(profile.backgroundUrl) || undefined,
        follows: readNumber(profile.follows) ?? 0,
        followeds: readNumber(profile.followeds) ?? 0,
        eventCount: readNumber(profile.eventCount) ?? 0,
        listenSongs: readNumber(profile.listenSongs) ?? 0,
        vipType,
        vipLevel,
        isVip: vipType > 0 || vipLevel > 0,
    };
}

async function musicPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(buildBackendUrl(path), {
        method: 'POST',
        headers: buildBackendHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    const data = await safeResponseJson(response) as T;

    if (!response.ok) {
        throw new Error(extractErrorMessage(data, `Music API error: ${response.status}`));
    }

    return data;
}

async function sameOriginPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    const data = await safeResponseJson(response) as T;

    if (!response.ok) {
        throw new Error(extractErrorMessage(data, `Music API error: ${response.status}`));
    }

    return data;
}

export function getMusicCookie(): string {
    try {
        return localStorage.getItem(COOKIE_KEY) || '';
    } catch {
        return '';
    }
}

export function setMusicCookie(cookie: string): void {
    try {
        localStorage.setItem(COOKIE_KEY, cookie);
    } catch {
        // Ignore localStorage failures.
    }
}

export function clearMusicCookie(): void {
    try {
        localStorage.removeItem(COOKIE_KEY);
    } catch {
        // Ignore localStorage failures.
    }
}

export function isMusicLoggedIn(): boolean {
    return Boolean(getMusicCookie());
}

export async function searchSongs(keyword: string, limit = 30, offset = 0): Promise<NeteaseSearchResult> {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
        return { songs: [], songCount: 0 };
    }

    const data = await musicPost<{ result?: unknown }>('/api/music/search', {
        keyword: trimmedKeyword,
        limit,
        offset,
        type: 1,
    });
    assertMusicApiSuccess(data, '网易云搜索暂时不可用');
    const result = asRecord(data.result);
    const rawSongs = Array.isArray(result?.songs) ? result.songs : [];
    const songs = rawSongs
        .map(normalizeSong)
        .filter((song): song is NeteaseSong => Boolean(song));
    const enrichedSongs = await enrichSongsWithAlbumCovers(songs);

    return {
        songs: enrichedSongs,
        songCount: readNumber(result?.songCount) ?? enrichedSongs.length,
    };
}

export async function getSongUrl(ids: number[]): Promise<NeteaseSongUrl[]> {
    const data = await musicPost<{ data?: unknown }>('/api/music/song/url', {
        ids,
        cookie: getMusicCookie(),
        br: 320000,
    });
    assertMusicApiSuccess(data, '网易云播放链接暂时不可用');
    const entries = Array.isArray(data.data) ? data.data : [];
    return entries
        .map(normalizeSongUrl)
        .filter((item): item is NeteaseSongUrl => Boolean(item));
}

export function getAudioProxyUrl(rawUrl: string | null | undefined): string | null {
    const trimmedUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmedUrl) return null;

    const target = buildBackendUrlObject('/api/music/audio-proxy');
    if (!target) return trimmedUrl;

    const authParams = new URLSearchParams(
        buildBackendAuthQuery({ tokenKey: '_token', userIdKey: '_userId' }),
    );
    for (const [key, value] of authParams.entries()) {
        target.searchParams.set(key, value);
    }

    target.searchParams.set('url', trimmedUrl);
    return target.toString();
}

export async function getLyric(id: number): Promise<NeteaseLyric> {
    const data = await musicPost<JsonRecord>('/api/music/lyric', { id });
    assertMusicApiSuccess(data, '网易云歌词暂时不可用');
    const lyric: NeteaseLyric = {};

    const lrc = asRecord(data.lrc);
    if (lrc) {
        lyric.lrc = { lyric: readString(lrc.lyric) };
    }

    const tlyric = asRecord(data.tlyric);
    if (tlyric) {
        lyric.tlyric = { lyric: readString(tlyric.lyric) };
    }

    return lyric;
}

export async function getSongDetail(ids: number[]): Promise<NeteaseSong[]> {
    const data = await musicPost<{ songs?: unknown }>('/api/music/song/detail', { ids });
    assertMusicApiSuccess(data, '网易云歌曲详情暂时不可用');
    const songs = Array.isArray(data.songs) ? data.songs : [];
    return songs
        .map(normalizeSong)
        .filter((song): song is NeteaseSong => Boolean(song));
}

export async function getPlaylistDetail(id: number): Promise<NeteasePlaylist | null> {
    const data = await musicPost<{ playlist?: unknown }>('/api/music/playlist/detail', {
        id,
        cookie: getMusicCookie(),
    });
    assertMusicApiSuccess(data, '网易云歌单详情暂时不可用');
    return normalizePlaylist(data.playlist);
}

export async function getTopPlaylists(cat = '全部', limit = 30): Promise<NeteasePlaylist[]> {
    const data = await musicPost<{ playlists?: unknown }>('/api/music/top/playlist', { cat, limit });
    assertMusicApiSuccess(data, '网易云推荐歌单暂时不可用');
    const playlists = Array.isArray(data.playlists) ? data.playlists : [];
    return playlists
        .map(normalizePlaylist)
        .filter((playlist): playlist is NeteasePlaylist => Boolean(playlist));
}

export async function getQrKey(): Promise<string> {
    const data = await musicPost<{ unikey?: unknown; data?: unknown }>('/api/music/login/qr/key', {});
    const dataRecord = asRecord(data.data);
    return readString(data.unikey) || readString(dataRecord?.unikey);
}

export async function getQrUrl(key: string): Promise<string> {
    const data = await musicPost<{ data?: unknown }>('/api/music/login/qr/create', { key });
    const dataRecord = asRecord(data.data);
    return readString(dataRecord?.qrurl);
}

export async function checkQrStatus(key: string): Promise<{ code: number; message?: string; cookie?: string }> {
    const data = await musicPost<JsonRecord>('/api/music/login/qr/check', { key });
    const nestedData = asRecord(data.data);
    const topLevelCode = readNumber(data.code);
    const nestedCode = readNumber(nestedData?.code);
    const code = (topLevelCode !== null && topLevelCode >= 800 && topLevelCode <= 899)
        ? topLevelCode
        : nestedCode ?? topLevelCode ?? 0;

    return {
        code,
        message: readString(data.message) || readString(nestedData?.message) || undefined,
        cookie: readString(data.cookie) || undefined,
    };
}

export async function getUserAccount(cookie = getMusicCookie()): Promise<NeteaseUserAccount | null> {
    const trimmedCookie = cookie.trim();
    if (!trimmedCookie) return null;

    const data = await musicPost<JsonRecord>('/api/music/user/account', { cookie: trimmedCookie });
    assertMusicApiSuccess(data, '网易云账号信息暂时不可用');
    return normalizeUserAccount(data);
}
