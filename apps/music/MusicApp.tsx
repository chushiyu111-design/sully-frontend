/**
 * MusicApp — 网易云音乐真实 API 版
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import type { NeteasePlaylist, NeteaseSong, NeteaseUserAccount } from '../../types/music';
import {
  checkQrStatus,
  clearMusicCookie,
  getPlaylistDetail,
  getQrKey,
  getQrUrl,
  getTopPlaylists,
  getUserAccount,
  isMusicLoggedIn,
  searchSongs,
  setMusicCookie,
} from '../../utils/musicService';
import './music.css';

const SEARCH_HISTORY_KEY = 'music_recent_keywords';

type MusicPage = 'discover' | 'search' | 'profile';
type PrimaryPage = Exclude<MusicPage, 'search'>;

type PlaylistPreviewState = {
  playlist: NeteasePlaylist | null;
  tracks: NeteaseSong[];
  loading: boolean;
  error: string | null;
};

const IconBack = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
const IconHome = ({ active }: { active?: boolean }) => <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />{!active && <polyline points="9 22 9 12 15 12 15 22" />}</svg>;
const IconSearchTab = ({ active }: { active?: boolean }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
const IconUser = ({ active }: { active?: boolean }) => <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IconPlay = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const IconPause = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>;
const IconPrev = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>;
const IconNext = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z" /></svg>;
const IconHeart = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>;
const IconMore = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>;
const IconPlaylist = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
const IconMiniPlay = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const IconMiniPause = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>;
const IconDown = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>;
const IconClear = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>;

function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

function writeSearchHistory(history: string[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Ignore storage failures.
  }
}

function getSongArtists(song: NeteaseSong): string {
  return song.artists.map((artist) => artist.name).join(' / ') || '未知歌手';
}

function getSongSubtitle(song: NeteaseSong): string {
  const albumName = song.album.name.trim();
  return albumName ? `${getSongArtists(song)} - ${albumName}` : getSongArtists(song);
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDurationMs(durationMs: number): string {
  return formatSeconds(durationMs / 1000);
}

function formatPlayCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 100000000) return `${(value / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (value >= 10000) return `${Math.round(value / 10000)}万`;
  return `${Math.round(value)}`;
}

function getFallbackGradient(seed: number): string {
  const hue = ((seed % 360) + 360) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 72%, 66%), hsl(${(hue + 42) % 360}, 68%, 48%))`;
}

function getVipLabel(account: NeteaseUserAccount | null): string {
  if (!account?.isVip) return '普通用户';
  if (account.vipLevel > 0) return `黑胶 VIP Lv.${account.vipLevel}`;
  return '黑胶 VIP';
}

function buildQrImageCandidates(qrUrl: string): string[] {
  const encoded = encodeURIComponent(qrUrl);
  return [
    `https://quickchart.io/qr?text=${encoded}&size=240`,
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`,
  ];
}

const CoverArt: React.FC<{ src?: string; alt: string; seed: number; className: string; note?: string; }> = React.memo(({ src, alt, seed, className, note = '♪' }) => (
  <div className={className} style={src ? undefined : { background: getFallbackGradient(seed) }}>
    {src ? <img src={src} alt={alt} /> : <span className="music-cover-fallback-note">{note}</span>}
  </div>
));

const SongRow: React.FC<{ song: NeteaseSong; currentSongId?: number; onClick: (song: NeteaseSong) => void; }> = React.memo(({ song, currentSongId, onClick }) => (
  <li className="music-song-item" onClick={() => onClick(song)}>
    <CoverArt src={song.album.picUrl} alt={song.name} seed={song.id} className="music-song-cover" />
    <div className="music-song-info">
      <div className={`music-song-name ${currentSongId === song.id ? 'playing' : ''}`}>{song.name}</div>
      <div className="music-song-artist">
        <span className="music-song-badge">{formatDurationMs(song.duration)}</span>
        {getSongSubtitle(song)}
      </div>
    </div>
    <div className="music-song-actions">
      <div className="music-song-action"><IconHeart /></div>
      <div className="music-song-action"><IconMore /></div>
    </div>
  </li>
));

const DiscoverPage: React.FC<{
  playlists: NeteasePlaylist[];
  playlistsLoading: boolean;
  playlistsError: string | null;
  previewPlaylist: NeteasePlaylist | null;
  previewTracks: NeteaseSong[];
  previewLoading: boolean;
  previewError: string | null;
  currentSongId?: number;
  onSearch: () => void;
  onPlaylistSelect: (playlist: NeteasePlaylist) => void;
  onSongClick: (song: NeteaseSong, playlist?: NeteaseSong[]) => void;
}> = React.memo(({
  playlists,
  playlistsLoading,
  playlistsError,
  previewPlaylist,
  previewTracks,
  previewLoading,
  previewError,
  currentSongId,
  onSearch,
  onPlaylistSelect,
  onSongClick,
}) => (
  <div className="music-discover-page music-no-scrollbar">
    <div className="music-search-bar" onClick={onSearch}>
      <div className="music-search-input-wrapper music-search-entry" style={{ cursor: 'pointer' }}>
        <IconSearch />
        <span style={{ fontSize: 14, color: '#bbb' }}>搜索歌曲、歌手、歌单</span>
      </div>
    </div>

    <div className="music-section-header">
      <div>
        <div className="music-section-title">推荐歌单</div>
        <div className="music-section-subtitle">来自网易云热度榜单的真实歌单</div>
      </div>
    </div>

    {playlistsError && (
      <div className="music-state-card">
        <div className="music-state-title">歌单加载失败</div>
        <div className="music-state-text">{playlistsError}</div>
      </div>
    )}

    {playlistsLoading && (
      <div className="music-playlist-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="music-playlist-card">
            <div className="music-playlist-cover music-skeleton" />
            <div className="music-playlist-name music-skeleton" style={{ height: 34, marginTop: 6 }} />
          </div>
        ))}
      </div>
    )}

    {!playlistsLoading && playlists.length > 0 && (
      <div className="music-playlist-grid">
        {playlists.map((playlist, index) => (
          <div
            key={playlist.id}
            className={`music-playlist-card ${previewPlaylist?.id === playlist.id ? 'active' : ''}`}
            onClick={() => onPlaylistSelect(playlist)}
          >
            <CoverArt src={playlist.coverImgUrl} alt={playlist.name} seed={playlist.id + index} className="music-playlist-cover" note="♫" />
            <div className="music-playlist-play-count">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
              {formatPlayCount(playlist.trackCount * 16000)}
            </div>
            <div className="music-playlist-name">{playlist.name}</div>
          </div>
        ))}
      </div>
    )}

    <div className="music-section-header">
      <div>
        <div className="music-section-title">{previewPlaylist ? `${previewPlaylist.name} 速览` : '歌单速览'}</div>
        <div className="music-section-subtitle">{previewPlaylist ? '点一首直接进入真实播放' : '点上方歌单后，这里会加载真实歌曲'}</div>
      </div>
    </div>

    {previewLoading && (
      <div className="music-state-card">
        <div className="music-inline-spinner" />
        <div className="music-state-text">正在拉取歌单歌曲...</div>
      </div>
    )}

    {!previewLoading && previewError && (
      <div className="music-state-card">
        <div className="music-state-title">歌单预览失败</div>
        <div className="music-state-text">{previewError}</div>
      </div>
    )}

    {!previewLoading && !previewError && previewTracks.length > 0 && (
      <div style={{ padding: '0 16px' }}>
        <ul className="music-song-list">
          {previewTracks.map((song) => (
            <SongRow key={song.id} song={song} currentSongId={currentSongId} onClick={(targetSong) => onSongClick(targetSong, previewTracks)} />
          ))}
        </ul>
      </div>
    )}

    <div style={{ height: 108 }} />
  </div>
));

const SearchPage: React.FC<{
  initialSuggestions: string[];
  currentSongId?: number;
  onBack: () => void;
  onSongClick: (song: NeteaseSong, playlist?: NeteaseSong[]) => void;
}> = React.memo(({ initialSuggestions, currentSongId, onBack, onSongClick }) => {
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<NeteaseSong[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readSearchHistory());
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const commitSearchHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    setSearchHistory((previous) => {
      const next = [trimmed, ...previous.filter((item) => item !== trimmed)].slice(0, 8);
      writeSearchHistory(next);
      return next;
    });
  }, []);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    writeSearchHistory([]);
  }, []);

  const runSearch = useCallback(async (term: string, options?: { commitHistory?: boolean }) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await searchSongs(trimmed, 30, 0);
      if (requestId !== requestIdRef.current) return;
      if (options?.commitHistory) commitSearchHistory(trimmed);
      setSearchResults(result.songs || []);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setSearchError(error instanceof Error ? error.message : '搜索失败，请稍后重试');
      setSearchResults([]);
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  }, [commitSearchHistory]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(() => { void runSearch(trimmed); }, 320);
    return () => window.clearTimeout(timeoutId);
  }, [keyword, runSearch]);

  const handleSubmit = useCallback(() => {
    void runSearch(keyword, { commitHistory: true });
  }, [keyword, runSearch]);

  const handleSuggestionClick = useCallback((term: string) => {
    setKeyword(term);
    commitSearchHistory(term);
  }, [commitSearchHistory]);

  return (
    <>
      <div className="music-search-bar">
        <div className="music-navbar-back" onClick={onBack}><IconBack /></div>
        <div className="music-search-input-wrapper">
          <IconSearch />
          <input
            ref={inputRef}
            className="music-search-input"
            placeholder="搜索歌曲、歌手、歌单"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSubmit(); }}
          />
          {keyword && <div onClick={() => { setKeyword(''); setSearchResults([]); setSearchError(null); }} style={{ cursor: 'pointer' }}><IconClear /></div>}
        </div>
        <div className="music-search-cancel" onClick={keyword.trim() ? handleSubmit : onBack}>{keyword.trim() ? '搜索' : '取消'}</div>
      </div>

      <div className="music-search-page music-no-scrollbar">
        {keyword.trim() && (
          <div className="music-search-tabs">
            {['单曲', '专辑', '歌单', '歌手'].map((tab, index) => (
              <div key={tab} className={`music-search-tab ${index === 0 ? 'active' : ''}`}>{tab}</div>
            ))}
          </div>
        )}

        {isSearching && <div className="music-loading-block"><div className="music-inline-spinner" /><div className="music-state-text">正在搜索“{keyword.trim()}”...</div></div>}

        {!isSearching && searchError && <div className="music-state-card"><div className="music-state-title">搜索出错了</div><div className="music-state-text">{searchError}</div></div>}

        {!isSearching && keyword.trim() && !searchError && searchResults.length > 0 && (
          <div style={{ paddingTop: 8 }}>
            <div className="music-result-header">单曲</div>
            <ul className="music-song-list">
              {searchResults.map((song) => (
                <SongRow key={song.id} song={song} currentSongId={currentSongId} onClick={(targetSong) => onSongClick(targetSong, searchResults)} />
              ))}
            </ul>
          </div>
        )}

        {!isSearching && keyword.trim() && !searchError && searchResults.length === 0 && <div className="music-state-card music-empty-state"><div className="music-state-title">没有找到匹配歌曲</div><div className="music-state-text">试试更短的关键词，或者换歌手名 / 歌名重新搜一下。</div></div>}

        {!keyword.trim() && (
          <>
            <div className="music-search-history">
              <div className="music-search-history-header">
                <div className="music-search-history-title">最近搜索</div>
                {searchHistory.length > 0 && <button type="button" className="music-text-button" onClick={clearSearchHistory}>清空</button>}
              </div>
              {searchHistory.length > 0 ? (
                <div className="music-search-history-tags">
                  {searchHistory.map((term) => (
                    <div key={term} className="music-search-history-tag" onClick={() => handleSuggestionClick(term)}>{term}</div>
                  ))}
                </div>
              ) : (
                <div className="music-state-text">还没有搜索记录，直接搜一首想听的歌吧。</div>
              )}
            </div>

            <div className="music-hot-section">
              <div className="music-hot-title">推荐搜索</div>
              <ul className="music-hot-list">
                {initialSuggestions.map((name, index) => (
                  <li key={name} className="music-hot-item" onClick={() => handleSuggestionClick(name)}>
                    <span className={`music-hot-rank ${index < 3 ? `top-${index + 1}` : ''}`}>{index + 1}</span>
                    <span className="music-hot-name">{name}</span>
                    {index === 0 && <span className="music-hot-badge">荐</span>}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div style={{ height: 80 }} />
      </div>
    </>
  );
});

const ProfilePage: React.FC<{
  account: NeteaseUserAccount | null;
  isLoading: boolean;
  error: string | null;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onSearch: () => void;
}> = React.memo(({ account, isLoading, error, isLoggedIn, onOpenLogin, onLogout, onSearch }) => {
  const backgroundStyle = account?.backgroundUrl ? {
    backgroundImage: `linear-gradient(to bottom, rgba(22,22,24,0.15), rgba(250,250,250,1)), url(${account.backgroundUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : undefined;

  return (
    <div className="music-profile-page music-no-scrollbar">
      <div className="music-profile-header">
        <div className="music-profile-bg" style={backgroundStyle} />
        <div className="music-profile-toolbar">
          <button type="button" className="music-icon-button" onClick={onSearch}><IconSearch /></button>
          {isLoggedIn && <button type="button" className="music-text-button music-text-button-danger" onClick={onLogout}>退出登录</button>}
        </div>

        {isLoading ? (
          <div className="music-profile-loading"><div className="music-inline-spinner" /><div className="music-state-text">正在同步网易云账号...</div></div>
        ) : isLoggedIn && account ? (
          <>
            <CoverArt src={account.avatarUrl} alt={account.nickname} seed={account.userId} className="music-profile-avatar" />
            <div className="music-profile-name">{account.nickname}{account.isVip && <span className="music-vip-badge">{getVipLabel(account)}</span>}</div>
            <div className="music-profile-stats">
              <div className="music-profile-stat"><span className="music-profile-stat-num">{account.follows}</span>关注</div>
              <div className="music-profile-stat"><span className="music-profile-stat-num">{account.followeds}</span>粉丝</div>
              <div className="music-profile-stat"><span className="music-profile-stat-num">{account.listenSongs}</span>累计听歌</div>
            </div>
            <div className="music-profile-tools">
              <div className="music-profile-tool"><span>账号</span><strong>{account.userId}</strong></div>
              <div className="music-profile-tool"><span>动态</span><strong>{account.eventCount}</strong></div>
              <div className="music-profile-tool"><span>状态</span><strong>{account.isVip ? 'VIP' : '普通'}</strong></div>
            </div>
            <div className="music-profile-summary-card"><div className="music-state-title">网易云账号已连接</div><div className="music-state-text">现在搜索、登录态和播放都走真实接口了。高码率歌曲会自动带上你的登录 cookie 请求。</div></div>
          </>
        ) : isLoggedIn ? (
          <div className="music-login-card">
            <div className="music-login-card-title">{error ? '账号已授权，但资料还没同步成功' : '账号已授权，正在准备资料'}</div>
            <div className="music-login-card-text">
              {error
                ? '这通常是登录态不完整或刚授权后的同步失败。重新扫码一次就能刷新完整 cookie。'
                : '昵称、头像和 VIP 状态正在从网易云拉取，通常几秒内就会刷新出来。'}
            </div>
            <button type="button" className="music-primary-button" onClick={onOpenLogin}>{error ? '重新扫码登录' : '重新打开二维码'}</button>
          </div>
        ) : (
          <div className="music-login-card">
            <div className="music-login-card-title">登录网易云账号</div>
            <div className="music-login-card-text">扫码后可以读取真实昵称、头像和 VIP 状态，并为需要登录态的歌曲拿到可播放链接。</div>
            <button type="button" className="music-primary-button" onClick={onOpenLogin}>打开二维码登录</button>
          </div>
        )}
      </div>

      {error && <div className="music-state-card" style={{ margin: '0 16px 16px' }}><div className="music-state-title">账号同步失败</div><div className="music-state-text">{error}</div><button type="button" className="music-secondary-button" onClick={onOpenLogin}>重新登录</button></div>}

      {!isLoggedIn && !isLoading && (
        <div className="music-profile-empty-stack">
          <div className="music-state-card"><div className="music-state-title">为什么需要登录？</div><div className="music-state-text">网易云部分歌曲播放链接依赖登录 cookie。登录后，播放器会优先走你的账号权限拿真实音频地址。</div></div>
          <div className="music-state-card"><div className="music-state-title">你会看到什么</div><div className="music-state-text">昵称、头像、VIP 状态和累计听歌数都会替换掉当前页面里的硬编码占位信息。</div></div>
        </div>
      )}

      <div style={{ height: 112 }} />
    </div>
  );
});

type QrModalStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'success' | 'expired' | 'error';

const QrLoginModal: React.FC<{ open: boolean; onClose: () => void; onSuccess: () => void; }> = ({ open, onClose, onSuccess }) => {
  const [status, setStatus] = useState<QrModalStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const pollTimerRef = useRef<number | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const qrImageCandidates = useMemo(() => qrUrl ? buildQrImageCandidates(qrUrl) : [], [qrUrl]);
  const qrImageSrc = qrImageCandidates[imageIndex] || '';
  const requiresOfficialVerification = statusText.includes('验证');

  const handleCopyQrUrl = useCallback(async () => {
    if (!qrUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setStatusText('二维码链接已复制，可用其他设备生成后扫码。');
    } catch {
      setStatusText('复制失败，请稍后再试。');
    }
  }, [qrUrl]);

  const handleOpenNeteaseWeb = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.open('https://music.163.com/#/login', '_blank', 'noopener,noreferrer');
  }, []);

  useEffect(() => {
    if (!open) {
      clearPollTimer();
      setStatus('idle');
      setStatusText('');
      setQrUrl('');
      setImageIndex(0);
      return;
    }

    let active = true;

    const pollStatus = async (key: string) => {
      try {
        const result = await checkQrStatus(key);
        if (!active) return;

        if (result.code === 801) {
          setStatus('waiting');
          setStatusText('请使用网易云音乐 App 扫码。');
          return;
        }
        if (result.code === 802) {
          setStatus('scanned');
          setStatusText('已扫码，请在手机上确认登录。');
          return;
        }
        if (result.code === 803) {
          clearPollTimer();
          if (!result.cookie) {
            setStatus('error');
            setStatusText('登录成功，但没有取到 cookie，请重新生成二维码。');
            return;
          }

          setStatus('success');
          setStatusText('登录成功，正在刷新“我的”页面...');
          setMusicCookie(result.cookie);
          onSuccess();
          window.setTimeout(() => {
            if (active) onClose();
          }, 500);
          return;
        }
        if (result.code === 800) {
          clearPollTimer();
          setStatus('expired');
          setStatusText('二维码已过期，请重新生成。');
          return;
        }

        setStatus('waiting');
        setStatusText(
          result.message
            ? `${result.message}${result.code > 0 ? `（状态码 ${result.code}）` : ''}`
            : '等待扫码中...',
        );
      } catch (error) {
        clearPollTimer();
        if (!active) return;
        setStatus('error');
        setStatusText(error instanceof Error ? error.message : '二维码状态检查失败');
      }
    };

    const initQr = async () => {
      setStatus('loading');
      setStatusText('正在生成二维码...');
      setQrUrl('');
      setImageIndex(0);

      try {
        const qrKey = await getQrKey();
        if (!active || !qrKey) throw new Error('没有获取到二维码 key');
        const nextQrUrl = await getQrUrl(qrKey);
        if (!active || !nextQrUrl) throw new Error('二维码内容生成失败');

        setQrUrl(nextQrUrl);
        setStatus('waiting');
        setStatusText('请使用网易云音乐 App 扫码。');
        await pollStatus(qrKey);
        if (!active) return;

        pollTimerRef.current = window.setInterval(() => { void pollStatus(qrKey); }, 2000);
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setStatusText(error instanceof Error ? error.message : '二维码生成失败');
      }
    };

    void initQr();

    return () => {
      active = false;
      clearPollTimer();
    };
  }, [clearPollTimer, onClose, onSuccess, open, retryToken]);

  if (!open) return null;

  return (
    <div className="music-modal-backdrop" onClick={onClose}>
      <div className="music-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="music-modal-header">
          <div>
            <div className="music-modal-title">扫码登录网易云</div>
            <div className="music-modal-subtitle">使用手机 App 扫码后，这台设备会同步你的登录态</div>
          </div>
          <button type="button" className="music-icon-button" onClick={onClose}>×</button>
        </div>

        <div className="music-qr-stage">
          {status === 'loading' ? (
            <div className="music-qr-placeholder"><div className="music-inline-spinner" /></div>
          ) : qrImageSrc ? (
            <div className="music-qr-box">
              <img
                src={qrImageSrc}
                alt="网易云二维码登录"
                className="music-qr-image"
                onError={() => setImageIndex((current) => current < qrImageCandidates.length - 1 ? current + 1 : current)}
              />
            </div>
          ) : (
            <div className="music-qr-placeholder">二维码暂不可用</div>
          )}
        </div>

        <div className={`music-qr-status music-qr-status-${status}`}>{statusText}</div>

        {requiresOfficialVerification && (
          <div className="music-state-card" style={{ margin: '0 0 16px', padding: '14px 16px' }}>
            <div className="music-state-title">这一步是网易云官方验证</div>
            <div className="music-state-text">先在网易云网页版完成一次验证，再回来重新扫码，通常就能进入成功回调。</div>
            <button type="button" className="music-secondary-button" onClick={handleOpenNeteaseWeb}>打开网易云网页版</button>
          </div>
        )}

        <div className="music-qr-actions">
          <button type="button" className="music-secondary-button" onClick={() => setRetryToken((value) => value + 1)}>重新生成</button>
          <button type="button" className="music-secondary-button" onClick={() => { void handleCopyQrUrl(); }} disabled={!qrUrl}>复制链接</button>
        </div>
      </div>
    </div>
  );
};

const FullPlayer: React.FC<{
  song: NeteaseSong;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (pct: number) => void;
}> = React.memo(({ song, isPlaying, progress, currentTime, duration, onClose, onTogglePlay, onPrev, onNext, onSeek }) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const backgroundStyle = song.album.picUrl ? { backgroundImage: `url(${song.album.picUrl})` } : { background: getFallbackGradient(song.id) };
  const displayDuration = duration > 0 ? duration : song.duration / 1000;

  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    onSeek(pct);
  }, [onSeek]);

  return (
    <div className="music-player-page">
      <div className="music-player-bg" style={backgroundStyle} />
      <div className="music-player-overlay" />
      <div className="music-player-content">
        <div className="music-player-header">
          <div style={{ cursor: 'pointer', padding: 4 }} onClick={onClose}><IconDown /></div>
          <div className="music-player-tabs">{['推荐', '音乐', '播客'].map((tab, index) => <div key={tab} className={`music-player-tab ${index === 1 ? 'active' : ''}`}>{tab}</div>)}</div>
          <div style={{ width: 24, cursor: 'pointer' }}><IconSearch /></div>
        </div>

        <div className="music-player-vinyl-area">
          <div className={`music-player-tonearm ${isPlaying ? 'playing' : 'paused'}`}>
            <div className="music-player-tonearm-pivot" />
            <div className="music-player-tonearm-arm" />
            <div className="music-player-tonearm-head" />
          </div>
          <div className={`music-player-vinyl ${isPlaying ? '' : 'paused'}`}>
            <div className="music-vinyl-groove" />
            <div className="music-vinyl-groove" />
            <div className="music-vinyl-groove" />
            <div className="music-vinyl-groove" />
            <CoverArt src={song.album.picUrl} alt={song.name} seed={song.id} className="music-vinyl-center" />
          </div>
        </div>

        <div className="music-player-song-info">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="music-player-song-name">{song.name}</div>
              <div className="music-player-song-artist">{getSongArtists(song)}<span className="music-player-quality-badge">{song.album.name || '网易云音乐'}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}><div style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><IconHeart /></div><div style={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><IconMore /></div></div>
          </div>
        </div>

        <div className="music-player-progress">
          <div ref={progressBarRef} className="music-player-progress-bar" onClick={handleProgressClick}>
            <div className="music-player-progress-fill" style={{ width: `${progress}%` }}><div className="music-player-progress-dot" /></div>
          </div>
          <div className="music-player-time"><span>{formatSeconds(currentTime)}</span><span>{formatSeconds(displayDuration)}</span></div>
        </div>

        <div className="music-player-controls">
          <div className="music-ctrl-btn" onClick={onPrev}><IconPrev /></div>
          <div className="music-ctrl-play" onClick={onTogglePlay}>{isPlaying ? <IconPause /> : <IconPlay />}</div>
          <div className="music-ctrl-btn" onClick={onNext}><IconNext /></div>
        </div>
      </div>
    </div>
  );
});

const MiniPlayer: React.FC<{ song: NeteaseSong | null; isPlaying: boolean; progress: number; onOpen: () => void; onTogglePlay: (event: React.MouseEvent) => void; }> = React.memo(({ song, isPlaying, progress, onOpen, onTogglePlay }) => {
  if (!song) return null;

  return (
    <div className="music-mini-player" onClick={onOpen}>
      <CoverArt src={song.album.picUrl} alt={song.name} seed={song.id} className={`music-mini-cover ${isPlaying ? '' : 'paused'}`} />
      <div className="music-mini-info">
        <div className="music-mini-title">{song.name} - {getSongArtists(song)}</div>
        <div className="music-mini-progress-track"><div className="music-mini-progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="music-mini-controls">
        <div className="music-mini-btn" onClick={onTogglePlay}>{isPlaying ? <IconMiniPause /> : <IconMiniPlay />}</div>
        <div className="music-mini-btn"><IconPlaylist /></div>
      </div>
    </div>
  );
});

const MusicApp: React.FC = () => {
  const { registerBackHandler } = useApp();
  const { currentSong, isPlaying, currentTime, duration, progress, playSong, togglePlay, playNext, playPrev, seek } = useAudioPlayer();

  const [currentPage, setCurrentPage] = useState<MusicPage>('discover');
  const [lastPrimaryPage, setLastPrimaryPage] = useState<PrimaryPage>('discover');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showQrLogin, setShowQrLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => isMusicLoggedIn());
  const [account, setAccount] = useState<NeteaseUserAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountReloadKey, setAccountReloadKey] = useState(0);
  const [playlists, setPlaylists] = useState<NeteasePlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreviewState>({ playlist: null, tracks: [], loading: false, error: null });

  const openSearch = useCallback(() => {
    setLastPrimaryPage(currentPage === 'profile' ? 'profile' : 'discover');
    setCurrentPage('search');
  }, [currentPage]);

  const closeSearch = useCallback(() => {
    setCurrentPage(lastPrimaryPage);
  }, [lastPrimaryPage]);

  const selectPrimaryPage = useCallback((page: PrimaryPage) => {
    setLastPrimaryPage(page);
    setCurrentPage(page);
  }, []);

  const handleSongClick = useCallback((song: NeteaseSong, playlist?: NeteaseSong[]) => {
    void playSong(song, playlist);
    setShowFullPlayer(true);
  }, [playSong]);

  const handleTogglePlay = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  const loadPlaylistPreview = useCallback(async (playlist: NeteasePlaylist) => {
    setPlaylistPreview({ playlist, tracks: [], loading: true, error: null });

    try {
      const detail = await getPlaylistDetail(playlist.id);
      const tracks = detail?.tracks?.slice(0, 12) || [];
      setPlaylistPreview({
        playlist: detail || playlist,
        tracks,
        loading: false,
        error: tracks.length > 0 ? null : '这个歌单暂时没有可预览的歌曲。',
      });
    } catch (error) {
      setPlaylistPreview({
        playlist,
        tracks: [],
        loading: false,
        error: error instanceof Error ? error.message : '歌单详情获取失败',
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadPlaylists = async () => {
      setPlaylistsLoading(true);
      setPlaylistsError(null);

      try {
        const nextPlaylists = await getTopPlaylists('全部', 6);
        if (!active) return;
        setPlaylists(nextPlaylists);
      } catch (error) {
        if (!active) return;
        setPlaylists([]);
        setPlaylistsError(error instanceof Error ? error.message : '推荐歌单加载失败');
      } finally {
        if (active) setPlaylistsLoading(false);
      }
    };

    void loadPlaylists();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (playlists.length === 0 || playlistPreview.playlist) return;
    void loadPlaylistPreview(playlists[0]);
  }, [loadPlaylistPreview, playlistPreview.playlist, playlists]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAccount(null);
      setAccountLoading(false);
      setAccountError(null);
      return;
    }

    if (currentPage !== 'profile' && accountReloadKey === 0) return;

    let active = true;
    setAccountLoading(true);
    setAccountError(null);

    const loadAccount = async () => {
      try {
        const nextAccount = await getUserAccount();
        if (!active) return;
        if (!nextAccount) throw new Error('没有拿到账号资料，请重新登录一次。');
        setAccount(nextAccount);
      } catch (error) {
        if (!active) return;
        setAccount(null);
        setAccountError(error instanceof Error ? error.message : '账号资料获取失败');
      } finally {
        if (active) setAccountLoading(false);
      }
    };

    void loadAccount();
    return () => { active = false; };
  }, [accountReloadKey, currentPage, isLoggedIn]);

  useEffect(() => registerBackHandler(() => {
    if (showQrLogin) {
      setShowQrLogin(false);
      return true;
    }
    if (showFullPlayer) {
      setShowFullPlayer(false);
      return true;
    }
    if (currentPage === 'search') {
      closeSearch();
      return true;
    }
    return false;
  }), [closeSearch, currentPage, registerBackHandler, showFullPlayer, showQrLogin]);

  const handleLoginSuccess = useCallback(() => {
    setIsLoggedIn(true);
    setAccount(null);
    setAccountError(null);
    setAccountReloadKey((value) => value + 1);
    setLastPrimaryPage('profile');
    setCurrentPage('profile');
  }, []);

  const handleLogout = useCallback(() => {
    clearMusicCookie();
    setIsLoggedIn(false);
    setAccount(null);
    setAccountError(null);
    setShowQrLogin(false);
  }, []);

  const suggestionKeywords = useMemo(() => {
    const raw = [...playlists.map((playlist) => playlist.name), ...playlistPreview.tracks.slice(0, 4).map((song) => song.name)];
    return Array.from(new Set(raw.filter(Boolean))).slice(0, 8);
  }, [playlistPreview.tracks, playlists]);

  return (
    <div className="music-app">
      {currentPage === 'discover' && (
        <DiscoverPage
          playlists={playlists}
          playlistsLoading={playlistsLoading}
          playlistsError={playlistsError}
          previewPlaylist={playlistPreview.playlist}
          previewTracks={playlistPreview.tracks}
          previewLoading={playlistPreview.loading}
          previewError={playlistPreview.error}
          currentSongId={currentSong?.id}
          onSearch={openSearch}
          onPlaylistSelect={loadPlaylistPreview}
          onSongClick={handleSongClick}
        />
      )}

      {currentPage === 'search' && (
        <SearchPage
          initialSuggestions={suggestionKeywords.length > 0 ? suggestionKeywords : ['周杰伦', '五月天', '陈奕迅', '薛之谦']}
          currentSongId={currentSong?.id}
          onBack={closeSearch}
          onSongClick={handleSongClick}
        />
      )}

      {currentPage === 'profile' && (
        <ProfilePage
          account={account}
          isLoading={accountLoading}
          error={accountError}
          isLoggedIn={isLoggedIn}
          onOpenLogin={() => setShowQrLogin(true)}
          onLogout={handleLogout}
          onSearch={openSearch}
        />
      )}

      {currentSong && !showFullPlayer && currentPage !== 'search' && (
        <MiniPlayer
          song={currentSong}
          isPlaying={isPlaying}
          progress={progress}
          onOpen={() => setShowFullPlayer(true)}
          onTogglePlay={handleTogglePlay}
        />
      )}

      {currentPage !== 'search' && !showFullPlayer && (
        <div className="music-tabbar">
          <div className={`music-tab-item ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => selectPrimaryPage('discover')}><IconHome active={currentPage === 'discover'} /><span>首页</span></div>
          <div className="music-tab-item" onClick={openSearch}><IconSearchTab /><span>搜索</span></div>
          <div className="music-tab-item"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg><span>笔记</span></div>
          <div className={`music-tab-item ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => selectPrimaryPage('profile')}><IconUser active={currentPage === 'profile'} /><span>我的</span></div>
        </div>
      )}

      {showFullPlayer && currentSong && (
        <FullPlayer
          song={currentSong}
          isPlaying={isPlaying}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          onClose={() => setShowFullPlayer(false)}
          onTogglePlay={togglePlay}
          onPrev={() => { void playPrev(); }}
          onNext={() => { void playNext(); }}
          onSeek={seek}
        />
      )}

      <QrLoginModal open={showQrLogin} onClose={() => setShowQrLogin(false)} onSuccess={handleLoginSuccess} />
    </div>
  );
};

export default MusicApp;
