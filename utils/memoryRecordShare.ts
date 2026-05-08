import type { MemoryRecord } from '../types';
import type { MemoryRecordPlayable } from '../types/music';
import { loadHtml2Canvas } from './lazyThirdParty';
import {
    sanitizeMemoryRecordMp3FileName,
    shareMemoryRecordFiles,
    type MemoryRecordExportFile,
    type MemoryRecordFileShareMethod,
} from './memoryRecordExport';
import { getMemoryRecordCoverImage } from './memoryRecordCovers';

export type MemoryRecordPosterShareMethod = MemoryRecordFileShareMethod;
export type MemoryRecordPackageShareMethod = MemoryRecordPosterShareMethod;

export interface MemoryRecordSharePreview {
    albumName: string;
    artistName: string;
    coverGradient?: string;
    coverImageUrl?: string;
    durationMs: number;
    lyricLines: string[];
    title: string;
}

export interface MemoryRecordPosterShareResult {
    cardFileName: string;
    fileNames: string[];
    method: MemoryRecordPosterShareMethod;
}

export type MemoryRecordPackageShareResult = MemoryRecordPosterShareResult;

export interface ShareMemoryRecordPosterOptions {
    renderCard?: (preview: MemoryRecordSharePreview) => Promise<Blob>;
    renderPoster?: (preview: MemoryRecordSharePreview) => Promise<Blob>;
}

export type ShareMemoryRecordPackageOptions = ShareMemoryRecordPosterOptions;

const SHARE_POSTER_WIDTH = 540;
const SHARE_POSTER_HEIGHT = 960;
const SHARE_POSTER_SCALE = 2;
const MAX_LYRIC_LINES = 2;
const MAX_LYRIC_LINE_LENGTH = 28;
const DEFAULT_SHARE_CARD_NAME = 'Emo Cloud 分享海报.png';
const BRACKETED_SECTION_RE = /^\s*[\[(【（].{0,24}[\])】）]\s*$/;
const TIMESTAMP_RE = /^\s*(?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?]\s*)+/;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncateText(value: string, maxLength: number): string {
    const text = value.trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeLyricLine(line: string): string {
    return line
        .replace(TIMESTAMP_RE, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function extractMemoryRecordShareLyricLines(lyrics: string | undefined): string[] {
    if (!lyrics) return [];

    const seen = new Set<string>();
    const result: string[] = [];

    for (const rawLine of lyrics.split(/\r?\n/)) {
        const line = normalizeLyricLine(rawLine);
        if (!line || BRACKETED_SECTION_RE.test(line) || seen.has(line)) continue;

        seen.add(line);
        result.push(truncateText(line, MAX_LYRIC_LINE_LENGTH));

        if (result.length >= MAX_LYRIC_LINES) break;
    }

    return result;
}

export function formatMemoryRecordShareDuration(durationMs: number | undefined): string {
    const safeMs = Number.isFinite(durationMs) ? Math.max(0, Number(durationMs)) : 0;
    if (safeMs <= 0) return '--:--';

    const totalSeconds = Math.round(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildMemoryRecordSharePreview(
    playable: MemoryRecordPlayable,
    record?: MemoryRecord,
): MemoryRecordSharePreview {
    return {
        albumName: playable.albumName || record?.albumName || '回忆唱片匣',
        artistName: playable.artistName || record?.artistName || record?.charName || 'Emo Cloud',
        coverGradient: playable.coverGradient || record?.coverGradient,
        coverImageUrl: playable.coverImageUrl || (record ? getMemoryRecordCoverImage(record) : undefined),
        durationMs: playable.duration || record?.durationMs || 0,
        lyricLines: extractMemoryRecordShareLyricLines(record?.lyrics || playable.lyrics),
        title: playable.name || record?.title || '未命名歌曲',
    };
}

function buildFallbackLyrics(preview: MemoryRecordSharePreview): string[] {
    return preview.lyricLines.length > 0
        ? preview.lyricLines
        : ['把这一段回忆轻轻压进唱片', '等夜色替我们按下播放键'];
}

/**
 * Generate deterministic waveform bar heights based on song title.
 * Returns an array of values between 0.12 and 0.95.
 */
export function generateWaveformHeights(title: string, count = 48): number[] {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
    return Array.from({ length: count }, (_, i) => {
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        const wave = Math.sin(i * 0.28) * 0.25 + Math.sin(i * 0.13) * 0.15 + 0.5;
        const noise = (h % 100) / 250;
        return Math.max(0.12, Math.min(0.95, wave + noise));
    });
}

function buildVinylGroovesSvg(): string {
    const grooves = Array.from({ length: 32 }, (_, i) => {
        const r = 22 + i * 2.3;
        const op = (0.03 + (i % 3) * 0.015).toFixed(3);
        return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(255,255,255,${op})" stroke-width="0.6"/>`;
    }).join('');
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="99" fill="#0e0e13"/>
        ${grooves}
        <circle cx="100" cy="100" r="18" fill="#1a1a22"/>
        <circle cx="100" cy="100" r="16" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>
        <circle cx="100" cy="100" r="3.5" fill="#0a0810"/>
        <defs><radialGradient id="vs" cx="38%" cy="36%" r="50%"><stop offset="0%" stop-color="rgba(255,255,255,0.06)"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>
        <circle cx="100" cy="100" r="99" fill="url(#vs)"/>
        <circle cx="100" cy="100" r="98.5" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </svg>`;
}

function buildWaveformBarsHtml(title: string): string {
    const heights = generateWaveformHeights(title);
    const bars = heights.map((h) => {
        const pct = Math.round(h * 100);
        return `<div style="flex:1;min-width:0;max-width:8px;height:${pct}%;border-radius:2px;background:linear-gradient(180deg,rgba(255,210,130,0.65),rgba(255,185,100,0.25));"></div>`;
    }).join('');
    return bars;
}

function buildShareCardHtml(preview: MemoryRecordSharePreview): string {
    const W = SHARE_POSTER_WIDTH;
    const H = SHARE_POSTER_HEIGHT;
    const gradient = preview.coverGradient || 'linear-gradient(135deg,#211f2e 0%,#b98f73 54%,#d8cab6 100%)';
    const coverStyle = preview.coverImageUrl ? '' : `background:${escapeHtml(gradient)};`;
    const lyrics = buildFallbackLyrics(preview)
        .map((line) => `<p style="margin:0;max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(line)}</p>`)
        .join('');
    const eCover = preview.coverImageUrl ? escapeHtml(preview.coverImageUrl) : '';
    const eGrad = escapeHtml(gradient);
    const vinylSvg = buildVinylGroovesSvg();
    const waveformBars = buildWaveformBarsHtml(preview.title);
    const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`;

    return `
    <div style="width:${W}px;height:${H}px;box-sizing:border-box;border-radius:38px;background:#0a0810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif;color:#fff;overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:36px 40px;">

        <!-- Blurred backdrop -->
        ${eCover ? `<img crossOrigin="anonymous" src="${eCover}" alt="" style="position:absolute;inset:-50px;width:calc(100% + 100px);height:calc(100% + 100px);object-fit:cover;filter:blur(36px) saturate(1.18);opacity:0.26;"/>` : ''}

        <!-- Gradient wash -->
        <div style="position:absolute;inset:0;background:${eGrad};opacity:0.72;"></div>
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 28%,rgba(45,18,65,0.55) 0%,transparent 52%),linear-gradient(180deg,rgba(10,8,16,0.25) 0%,rgba(10,8,16,0.08) 30%,rgba(10,8,16,0.88) 100%);"></div>

        <!-- Grain -->
        <div style="position:absolute;inset:0;background-image:${noiseSvg};background-size:128px 128px;opacity:0.5;mix-blend-mode:overlay;pointer-events:none;"></div>

        <!-- Light leak -->
        <div style="position:absolute;top:-12%;right:-8%;width:52%;height:42%;background:radial-gradient(ellipse at center,rgba(255,195,110,0.14) 0%,transparent 68%);filter:blur(40px);pointer-events:none;"></div>

        <!-- Vignette -->
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 28%,rgba(5,3,10,0.52) 100%);pointer-events:none;"></div>

        <!-- Frame -->
        <div style="position:absolute;inset:14px;border:1px solid rgba(255,255,255,0.07);border-radius:30px;pointer-events:none;"></div>

        <!-- Header -->
        <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <span style="font-size:13px;font-weight:850;letter-spacing:0.24em;color:rgba(255,255,255,0.58);">EMO CLOUD</span>
            <span style="font-size:16px;font-weight:800;color:rgba(255,228,175,0.82);">${formatMemoryRecordShareDuration(preview.durationMs)}</span>
        </div>

        <!-- Vinyl + Cover Stage -->
        <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;height:340px;">
            <!-- Vinyl disc -->
            <div style="position:absolute;right:20px;top:50%;transform:translateY(-50%);width:230px;height:230px;border-radius:50%;background:#0e0e13;box-shadow:0 16px 40px rgba(0,0,0,0.55),inset 0 0 0 1px rgba(255,255,255,0.04);overflow:hidden;">
                ${vinylSvg}
            </div>
            <!-- Cover -->
            <div style="position:relative;z-index:2;width:264px;height:264px;border-radius:30px;padding:8px;background:rgba(255,255,255,0.12);box-shadow:0 24px 56px rgba(0,0,0,0.5),0 0 0 0.5px rgba(255,255,255,0.1);transform:translateX(-12%);">
                <div style="width:100%;height:100%;border-radius:23px;overflow:hidden;${coverStyle}box-shadow:inset 0 0 0 1px rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;">
                    ${eCover ? `<img crossOrigin="anonymous" src="${eCover}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"/>` : `<span style="font-size:72px;font-family:Georgia,serif;color:rgba(255,255,255,0.7);text-shadow:0 8px 20px rgba(0,0,0,0.3);">♪</span>`}
                </div>
            </div>
        </div>

        <!-- Title + Artist -->
        <div style="position:relative;z-index:1;text-align:left;">
            <h1 style="margin:0;max-width:460px;font-size:38px;line-height:1.1;font-weight:850;color:#fff7dc;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 14px rgba(0,0,0,0.3);">${escapeHtml(preview.title)}</h1>
            <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
                <span style="font-size:16px;font-weight:700;color:rgba(255,255,255,0.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;">${escapeHtml(preview.artistName)}</span>
                <span style="width:4px;height:4px;border-radius:50%;background:rgba(255,220,160,0.4);flex-shrink:0;"></span>
                <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${escapeHtml(preview.albumName)}</span>
            </div>
        </div>

        <!-- Glassmorphism Lyrics -->
        <div style="position:relative;z-index:1;border-radius:18px;padding:16px 20px 16px 24px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 24px rgba(0,0,0,0.2);overflow:hidden;color:rgba(255,248,228,0.85);font-size:17px;font-weight:620;line-height:1.65;text-shadow:0 1px 8px rgba(0,0,0,0.2);">
            <div style="position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:2px;background:linear-gradient(180deg,rgba(255,210,130,0.8),rgba(255,185,100,0.4));"></div>
            ${lyrics}
        </div>

        <!-- Waveform -->
        <div style="position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:center;gap:3px;height:36px;">
            ${waveformBars}
        </div>

        <!-- Footer -->
        <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;color:rgba(255,255,255,0.48);font-size:12px;font-weight:850;letter-spacing:0.18em;">
            <span>一起写歌</span>
            <span>MEMORY RECORD</span>
        </div>
    </div>
    `;
}

async function waitForImages(root: HTMLElement): Promise<void> {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();

        return new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
        });
    }));
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob === 'function') {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }
                reject(new Error('分享海报生成失败'));
            }, 'image/png');
            return;
        }

        try {
            fetch(canvas.toDataURL('image/png'))
                .then((response) => response.blob())
                .then(resolve)
                .catch(reject);
        } catch (error) {
            reject(error);
        }
    });
}

export async function renderMemoryRecordSharePosterPng(preview: MemoryRecordSharePreview): Promise<Blob> {
    if (typeof document === 'undefined') {
        throw new Error('当前环境无法生成分享海报');
    }

    const host = document.createElement('div');
    host.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        `width:${SHARE_POSTER_WIDTH}px`,
        'background:transparent',
        'pointer-events:none',
        'z-index:-1',
    ].join(';');
    host.innerHTML = buildShareCardHtml(preview);
    document.body.appendChild(host);

    try {
        await waitForImages(host);
        const card = host.firstElementChild as HTMLElement | null;
        if (!card) throw new Error('分享海报生成失败');

        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(card, {
            backgroundColor: null,
            logging: false,
            scale: SHARE_POSTER_SCALE,
            useCORS: true,
            width: SHARE_POSTER_WIDTH,
            height: SHARE_POSTER_HEIGHT,
        });

        return canvasToPngBlob(canvas);
    } finally {
        document.body.removeChild(host);
    }
}

export const renderMemoryRecordShareCardPng = renderMemoryRecordSharePosterPng;

export function getMemoryRecordShareCardFileName(title: string, artistName: string): string {
    const mp3Name = sanitizeMemoryRecordMp3FileName(title, artistName);
    const cardName = mp3Name.replace(/\.mp3$/i, '.png');
    return cardName === mp3Name ? DEFAULT_SHARE_CARD_NAME : cardName;
}

export async function shareMemoryRecordPoster(
    playable: MemoryRecordPlayable,
    options: ShareMemoryRecordPosterOptions = {},
): Promise<MemoryRecordPosterShareResult> {
    const preview = buildMemoryRecordSharePreview(playable);
    const renderPoster = options.renderPoster || options.renderCard || renderMemoryRecordSharePosterPng;
    const cardBlob = await renderPoster(preview);
    const cardFileName = getMemoryRecordShareCardFileName(preview.title, preview.artistName);
    const cardFile: MemoryRecordExportFile = {
        blob: cardBlob,
        fileName: cardFileName,
    };
    const files = [cardFile];
    const method = await shareMemoryRecordFiles(files, `${preview.title} - Emo Cloud`);

    return {
        cardFileName,
        fileNames: files.map((file) => file.fileName),
        method,
    };
}

export async function shareMemoryRecordPackage(
    playable: MemoryRecordPlayable,
    options: ShareMemoryRecordPackageOptions = {},
): Promise<MemoryRecordPackageShareResult> {
    return shareMemoryRecordPoster(playable, options);
}
