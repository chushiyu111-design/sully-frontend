export interface NeteaseArtist {
    id: number;
    name: string;
}

export interface NeteaseAlbum {
    id: number;
    name: string;
    picUrl?: string;
}

export interface NeteaseSong {
    id: number;
    name: string;
    artists: NeteaseArtist[];
    album: NeteaseAlbum;
    duration: number;
}

export interface NeteaseSearchResult {
    songs?: NeteaseSong[];
    songCount?: number;
}

export interface NeteaseSongUrl {
    id: number;
    url: string | null;
    br: number;
    size: number;
    type: string;
}

export interface NeteaseLyric {
    lrc?: { lyric: string };
    tlyric?: { lyric: string };
}

export interface NeteasePlaylistCreator {
    userId: number;
    nickname: string;
    avatarUrl: string;
}

export interface NeteasePlaylist {
    id: number;
    name: string;
    coverImgUrl: string;
    trackCount: number;
    tracks?: NeteaseSong[];
    creator?: NeteasePlaylistCreator;
}

export interface NeteaseUserAccount {
    userId: number;
    nickname: string;
    avatarUrl: string;
    backgroundUrl?: string;
    follows: number;
    followeds: number;
    eventCount: number;
    listenSongs: number;
    vipType: number;
    vipLevel: number;
    isVip: boolean;
}

export interface SongShareCard {
    songId: number;
    songName: string;
    artist: string;
    albumName?: string;
    albumCover?: string;
    duration?: number;
}

export interface SongCardMetadata extends SongShareCard {
    type: 'song_card';
}

export interface LyricLine {
    time: number;
    text: string;
    translation?: string;
}
