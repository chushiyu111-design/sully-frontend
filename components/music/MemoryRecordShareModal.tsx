import React, { useMemo } from 'react';
import type { MemoryRecordPlayable } from '../../types/music';
import {
    buildMemoryRecordSharePreview,
    formatMemoryRecordShareDuration,
    generateWaveformHeights,
} from '../../utils/memoryRecordShare';
import './memoryRecordShareModal.css';

interface MemoryRecordShareModalProps {
    isSharing: boolean;
    onClose: () => void;
    onShare: () => void;
    playable: MemoryRecordPlayable | null;
}

/** SVG vinyl record with concentric grooves */
const VinylDiscSvg: React.FC = () => (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="vd-shine" cx="38%" cy="36%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="100%" stopColor="transparent" />
            </radialGradient>
        </defs>
        {/* Base disc */}
        <circle cx="100" cy="100" r="99" fill="#0e0e13" />
        {/* Grooves */}
        {Array.from({ length: 32 }, (_, i) => {
            const r = 22 + i * 2.3;
            const opacity = 0.03 + (i % 3) * 0.015;
            return (
                <circle
                    key={i}
                    cx="100" cy="100" r={r}
                    fill="none"
                    stroke={`rgba(255,255,255,${opacity})`}
                    strokeWidth="0.6"
                />
            );
        })}
        {/* Label area */}
        <circle cx="100" cy="100" r="18" fill="#1a1a22" />
        <circle cx="100" cy="100" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        {/* Center hole */}
        <circle cx="100" cy="100" r="3.5" fill="#0a0810" />
        {/* Shine */}
        <circle cx="100" cy="100" r="99" fill="url(#vd-shine)" />
        {/* Edge highlight */}
        <circle cx="100" cy="100" r="98.5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
    </svg>
);

const MemoryRecordShareModal: React.FC<MemoryRecordShareModalProps> = ({
    isSharing,
    onClose,
    onShare,
    playable,
}) => {
    const preview = useMemo(
        () => (playable ? buildMemoryRecordSharePreview(playable) : null),
        [playable],
    );

    const waveformBars = useMemo(
        () => generateWaveformHeights(preview?.title || ''),
        [preview?.title],
    );

    if (!preview) return null;

    const lyricLines = preview.lyricLines.length > 0
        ? preview.lyricLines
        : ['把这一段回忆轻轻压进唱片', '等夜色替我们按下播放键'];
    const posterGradient = preview.coverGradient || 'linear-gradient(135deg,#211f2e 0%,#b98f73 54%,#d8cab6 100%)';

    return (
        <div
            className="memory-record-share-modal-backdrop"
            onClick={isSharing ? undefined : onClose}
        >
            <div
                className="memory-record-share-modal"
                role="dialog"
                aria-modal="true"
                aria-label="分享一起写歌作品"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="memory-record-share-card-preview">
                    {/* ── Background layers ── */}
                    {preview.coverImageUrl ? (
                        <img
                            className="memory-record-share-card-backdrop"
                            src={preview.coverImageUrl}
                            alt=""
                        />
                    ) : null}
                    <div
                        className="memory-record-share-card-wash"
                        style={{ background: posterGradient }}
                    />
                    <div className="memory-record-share-card-grain" />
                    <div className="memory-record-share-card-leak" />
                    <div className="memory-record-share-card-vignette" />
                    <div className="memory-record-share-card-frame" />

                    {/* ── Header ── */}
                    <div className="memory-record-share-card-header">
                        <span>EMO CLOUD</span>
                        <span>{formatMemoryRecordShareDuration(preview.durationMs)}</span>
                    </div>

                    {/* ── Vinyl + Cover Stage ── */}
                    <div className="memory-record-share-card-stage">
                        <div className="memory-record-share-card-vinyl">
                            <VinylDiscSvg />
                        </div>
                        <div className="memory-record-share-card-cover-shell">
                            <div
                                className="memory-record-share-card-cover"
                                style={preview.coverImageUrl ? undefined : { background: posterGradient }}
                            >
                                {preview.coverImageUrl ? (
                                    <img src={preview.coverImageUrl} alt={preview.title} />
                                ) : (
                                    <span>♪</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Title + Artist ── */}
                    <div className="memory-record-share-card-meta">
                        <h3>{preview.title}</h3>
                        <div className="memory-record-share-card-meta-sub">
                            <p>{preview.artistName}</p>
                            <div className="vd-dot" />
                            <span>{preview.albumName}</span>
                        </div>
                    </div>

                    {/* ── Glassmorphism Lyrics ── */}
                    <div className="memory-record-share-card-lyrics">
                        {lyricLines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>

                    {/* ── Waveform ── */}
                    <div className="memory-record-share-card-waveform">
                        {waveformBars.map((h, i) => (
                            <div
                                key={i}
                                className="memory-record-share-card-waveform-bar"
                                style={{ height: `${Math.round(h * 100)}%` }}
                            />
                        ))}
                    </div>

                    {/* ── Footer ── */}
                    <div className="memory-record-share-card-footer">
                        <span>一起写歌</span>
                        <span>MEMORY RECORD</span>
                    </div>
                </div>

                <div className="memory-record-share-modal-copy">
                    <h2>分享海报</h2>
                    <p>会生成一张适合发布的 PNG 海报。想保存能听的音频，可以继续用播放器里的"导出 MP3"。</p>
                </div>

                <div className="memory-record-share-modal-actions">
                    <button
                        type="button"
                        className="memory-record-share-modal-btn memory-record-share-modal-btn--primary"
                        disabled={isSharing}
                        onClick={onShare}
                    >
                        {isSharing ? '生成中...' : '分享海报'}
                    </button>
                    <button
                        type="button"
                        className="memory-record-share-modal-btn memory-record-share-modal-btn--secondary"
                        disabled={isSharing}
                        onClick={onClose}
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MemoryRecordShareModal;
