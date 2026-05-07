/**
 * TheaterFloatingBall — 520约会剧场独立悬浮球
 * 粉色系主题，不与见面的 SummaryFloatingBall 耦合。
 * 实装：场景切换、设置入口、氛围 BGM
 * 占位：记忆印记、心情读取、取景框
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, PanInfo } from 'framer-motion';

const DEFAULT_BALL_ICON = '/theater-ball-default.jpg';
const ICON_STORAGE_PREFIX = 'theater_ball_icon_';
const ICON_MAX_SIZE = 96; // resize uploaded images to 96x96

/** Resize an image file to a small square via canvas, return base64 data URL */
const resizeImageToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = ICON_MAX_SIZE;
            canvas.height = ICON_MAX_SIZE;
            const ctx = canvas.getContext('2d')!;
            // cover crop: take center square
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, ICON_MAX_SIZE, ICON_MAX_SIZE);
            resolve(canvas.toDataURL('image/webp', 0.8));
        };
        img.onerror = reject;
        img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});
import type { BgmStatus } from '../../utils/theaterBgm';

interface TheaterFloatingBallProps {
    charId: string;
    onChangeLocation: () => void;
    onOpenSettings: () => void;
    /** BGM state */
    bgmStatus: BgmStatus;
    bgmEnabled: boolean;
    bgmVolume: number;
    onBgmToggle: () => void;
    onBgmVolumeChange: (v: number) => void;
    onBgmRegenerate: () => void;
    /** Summary state */
    isSummaryGenerating?: boolean;
    hasPendingSummary?: boolean;
    canManualSummary?: boolean;
    canAutoSummary?: boolean;
    summaryDisabledReason?: string;
    onRequestSummary?: () => void;
    onReviewPendingSummary?: () => void;
    onDiscardPendingSummary?: () => void;
    onToggleAutoSummary?: (enabled: boolean) => void;
    onToggleAutoHideSummary?: (enabled: boolean) => void;
    onChangeThreshold?: (threshold: number) => void;
    onOpenSummarySettings?: () => void;
    /** Character state for reading toggles */
    theaterSummaryAutoEnabled?: boolean;
    theaterSummaryAutoHideEnabled?: boolean;
    theaterSummaryAutoThreshold?: number;
}

const BALL_SIZE = 48;
const EDGE_PADDING = 10;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const readPos = (key: string) => {
    try {
        const p = JSON.parse(localStorage.getItem(key) || 'null');
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return p as { x: number; y: number };
    } catch { /* ignore */ }
    return null;
};

const defaultPos = () => ({
    x: typeof window !== 'undefined' ? Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - 16) : 20,
    y: typeof window !== 'undefined' ? Math.max(EDGE_PADDING, Math.round(window.innerHeight * 0.42)) : 200,
});

/* ── Placeholder menu item ── */
const PlaceholderItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 opacity-40 cursor-not-allowed">
        <div className="flex items-center gap-2.5">
            <span className="text-base">{icon}</span>
            <span className="text-xs text-white/70">{label}</span>
        </div>
        <span className="text-[9px] text-white/30 tracking-wider">即将推出</span>
    </div>
);

const TheaterFloatingBall: React.FC<TheaterFloatingBallProps> = memo(({
    charId,
    onChangeLocation,
    onOpenSettings,
    bgmStatus, bgmEnabled, bgmVolume,
    onBgmToggle, onBgmVolumeChange, onBgmRegenerate,
    isSummaryGenerating, hasPendingSummary, canManualSummary, canAutoSummary,
    summaryDisabledReason,
    onRequestSummary, onReviewPendingSummary, onDiscardPendingSummary,
    onToggleAutoSummary, onToggleAutoHideSummary, onChangeThreshold,
    onOpenSummarySettings,
    theaterSummaryAutoEnabled, theaterSummaryAutoHideEnabled, theaterSummaryAutoThreshold,
}) => {
    const storageKey = `theater_ball_pos_${charId}`;
    const iconKey = `${ICON_STORAGE_PREFIX}${charId}`;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const constraintsRef = useRef<HTMLDivElement>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [position, setPosition] = useState(() => readPos(storageKey) || defaultPos());
    const [dragging, setDragging] = useState(false);
    const [customIcon, setCustomIcon] = useState<string | null>(() => {
        try { return localStorage.getItem(iconKey); } catch { return null; }
    });
    const x = useMotionValue(position.x);
    const y = useMotionValue(position.y);

    // The icon to display: custom > default
    const ballIconUrl = customIcon || DEFAULT_BALL_ICON;

    const handleIconUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await resizeImageToDataUrl(file);
            localStorage.setItem(iconKey, dataUrl);
            setCustomIcon(dataUrl);
        } catch (err) {
            console.error('[TheaterFloatingBall] Failed to process icon:', err);
        }
        // reset input so same file can be re-selected
        e.target.value = '';
    }, [iconKey]);

    const handleResetIcon = useCallback(() => {
        localStorage.removeItem(iconKey);
        setCustomIcon(null);
    }, [iconKey]);

    useEffect(() => {
        const next = readPos(storageKey) || defaultPos();
        const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
        const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
        const c = { x: clamp(next.x, EDGE_PADDING, maxX), y: clamp(next.y, EDGE_PADDING, maxY) };
        setPosition(c); x.set(c.x); y.set(c.y);
    }, [charId]);

    useEffect(() => {
        const onResize = () => {
            const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
            const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
            const c = { x: clamp(x.get(), EDGE_PADDING, maxX), y: clamp(y.get(), EDGE_PADDING, maxY) };
            setPosition(c); x.set(c.x); y.set(c.y);
            localStorage.setItem(storageKey, JSON.stringify(c));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [storageKey]);

    const panelPlacement = useMemo(() => ({
        horizontal: position.x > window.innerWidth - 240 ? 'left' as const : 'right' as const,
        vertical: position.y > window.innerHeight - 340 ? 'up' as const : 'down' as const,
    }), [position]);

    const panelStyle: React.CSSProperties = {
        left: panelPlacement.horizontal === 'right' ? BALL_SIZE + 8 : undefined,
        right: panelPlacement.horizontal === 'left' ? BALL_SIZE + 8 : undefined,
        top: panelPlacement.vertical === 'down' ? -4 : undefined,
        bottom: panelPlacement.vertical === 'up' ? -4 : undefined,
    };

    const commitPos = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
        const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
        const c = { x: clamp(x.get(), EDGE_PADDING, maxX), y: clamp(y.get(), EDGE_PADDING, maxY) };
        setPosition(c); x.set(c.x); y.set(c.y);
        if (Math.hypot(info.offset.x, info.offset.y) >= 10) {
            localStorage.setItem(storageKey, JSON.stringify(c));
        }
        window.setTimeout(() => setDragging(false), 0);
    };

    return (
        <div
            ref={constraintsRef}
            className="absolute inset-0 z-[90]"
            style={{ pointerEvents: panelOpen ? 'auto' : 'none' }}
            onClick={() => panelOpen && setPanelOpen(false)}
        >
            <motion.div
                drag={!panelOpen}
                dragConstraints={constraintsRef}
                dragMomentum={false}
                dragElastic={0}
                style={{ x, y }}
                onDragStart={() => setDragging(true)}
                onDragEnd={commitPos}
                className="absolute left-0 top-0 pointer-events-auto"
            >
                {/* Hidden file input for icon upload */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleIconUpload}
                />

                {/* Ball */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (!dragging) setPanelOpen(v => !v); }}
                    className={`relative flex items-center justify-center rounded-full transition-all active:scale-90 ${dragging ? 'opacity-60' : 'opacity-100'}`}
                    style={{ width: BALL_SIZE, height: BALL_SIZE }}
                >
                    {/* Glow */}
                    <span className="absolute inset-0 rounded-full" style={{
                        background: 'radial-gradient(circle, rgba(255,107,157,0.35) 0%, transparent 70%)',
                        animation: 'theater-pulse 3s ease-in-out infinite',
                    }} />
                    {/* Core — custom image or default */}
                    <span className="relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden" style={{
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        boxShadow: '0 4px 20px rgba(255,107,157,0.4)',
                    }}>
                        <img
                            src={ballIconUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                            onError={(e) => {
                                // fallback to pink gradient if image fails
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </span>
                </button>

                {/* Panel */}
                {panelOpen && (
                    <div
                        className="control-panel absolute w-56 rounded-2xl border p-3 text-white shadow-2xl"
                        style={{
                            ...panelStyle,
                            background: 'rgba(15, 5, 10, 0.85)',
                            backdropFilter: 'blur(28px) saturate(1.4)',
                            WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
                            borderColor: 'rgba(255,107,157,0.15)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-[11px] font-bold tracking-widest" style={{ color: 'rgba(255,107,157,0.8)' }}>✦ 520 工具箱</span>
                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgba(255,255,255,0.4)" width={12} height={12}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-0.5">
                            {/* Scene Switch — working */}
                            <button
                                type="button"
                                onClick={() => { setPanelOpen(false); onChangeLocation(); }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors active:bg-white/10"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                                <span className="text-base">🗺️</span>
                                <span className="text-xs text-white/80 font-medium">场景切换</span>
                            </button>

                            {/* Settings — working */}
                            <button
                                type="button"
                                onClick={() => { setPanelOpen(false); onOpenSettings(); }}
                                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors active:bg-white/10"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                                <span className="text-base">⚙️</span>
                                <span className="text-xs text-white/80 font-medium">立绘设置</span>
                            </button>

                            {/* Divider */}
                            <div className="my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                            {/* BGM — functional */}
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <button
                                    type="button"
                                    onClick={onBgmToggle}
                                    className="w-full flex items-center justify-between gap-2 mb-1"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">{bgmEnabled ? '🎵' : '🔇'}</span>
                                        <span className="text-xs text-white/80 font-medium">氛围 BGM</span>
                                    </div>
                                    <span className="text-[9px] tracking-wider" style={{
                                        color: bgmStatus === 'generating' ? 'rgba(255,182,73,0.8)'
                                            : bgmStatus === 'ready' ? 'rgba(130,255,170,0.7)'
                                            : bgmStatus === 'error' ? 'rgba(255,100,100,0.7)'
                                            : 'rgba(255,255,255,0.3)',
                                    }}>
                                        {bgmStatus === 'generating' ? '生成中…'
                                            : bgmStatus === 'ready' ? '播放中'
                                            : bgmStatus === 'error' ? '失败'
                                            : bgmEnabled ? '等待' : '已关闭'}
                                    </span>
                                </button>
                                {bgmEnabled && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-white/30">🔈</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={Math.round(bgmVolume * 100)}
                                            onChange={e => onBgmVolumeChange(Number(e.target.value) / 100)}
                                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                                            style={{
                                                background: `linear-gradient(to right, rgba(255,107,157,0.6) ${bgmVolume * 100}%, rgba(255,255,255,0.1) ${bgmVolume * 100}%)`,
                                                accentColor: '#ff6b9d',
                                            }}
                                        />
                                        <span className="text-[10px] text-white/30">🔊</span>
                                    </div>
                                )}
                                {bgmStatus === 'ready' && bgmEnabled && (
                                    <button
                                        type="button"
                                        onClick={onBgmRegenerate}
                                        className="w-full mt-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        🔄 重新生成
                                    </button>
                                )}
                            </div>
                            {/* Divider */}
                            <div className="my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                            {/* ── Summary Controls ── */}
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {/* Auto Summary Toggle */}
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">📝</span>
                                        <span className="text-xs text-white/80 font-medium">自动总结</span>
                                    </div>
                                    {canAutoSummary ? (
                                        <button
                                            type="button"
                                            onClick={() => onToggleAutoSummary?.(!theaterSummaryAutoEnabled)}
                                            className="w-9 h-5 rounded-full transition-colors relative"
                                            style={{ background: theaterSummaryAutoEnabled ? 'rgba(130,255,170,0.4)' : 'rgba(255,255,255,0.1)' }}
                                        >
                                            <span className="absolute top-0.5 transition-all w-4 h-4 rounded-full bg-white shadow" style={{ left: theaterSummaryAutoEnabled ? 18 : 2 }} />
                                        </button>
                                    ) : (
                                        <span className="text-[9px] text-white/30 tracking-wider">{summaryDisabledReason || '需副API'}</span>
                                    )}
                                </div>
                                {/* Threshold */}
                                {theaterSummaryAutoEnabled && (
                                    <div className="flex items-center gap-2 mt-1 mb-1">
                                        <span className="text-[10px] text-white/40">每</span>
                                        <input
                                            type="number"
                                            min={8}
                                            max={100}
                                            value={theaterSummaryAutoThreshold || 20}
                                            onChange={e => onChangeThreshold?.(Math.max(8, Number(e.target.value) || 20))}
                                            className="w-12 text-center text-[11px] rounded-lg py-0.5 bg-white/5 text-white/70 border border-white/10 outline-none"
                                        />
                                        <span className="text-[10px] text-white/40">条触发</span>
                                    </div>
                                )}
                                {/* Auto Hide Toggle */}
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[10px] text-white/50">压缩旧记录</span>
                                    <button
                                        type="button"
                                        onClick={() => onToggleAutoHideSummary?.(!theaterSummaryAutoHideEnabled)}
                                        className="w-9 h-5 rounded-full transition-colors relative"
                                        style={{ background: theaterSummaryAutoHideEnabled ? 'rgba(130,255,170,0.4)' : 'rgba(255,255,255,0.1)' }}
                                    >
                                        <span className="absolute top-0.5 transition-all w-4 h-4 rounded-full bg-white shadow" style={{ left: theaterSummaryAutoHideEnabled ? 18 : 2 }} />
                                    </button>
                                </div>
                                {/* Pending Summary */}
                                {hasPendingSummary && (
                                    <div className="flex gap-1.5 mt-2">
                                        <button type="button" onClick={onReviewPendingSummary} className="flex-1 text-[10px] py-1.5 rounded-lg" style={{ background: 'rgba(130,255,170,0.15)', color: 'rgba(130,255,170,0.9)' }}>
                                            查看待确认
                                        </button>
                                        <button type="button" onClick={onDiscardPendingSummary} className="text-[10px] py-1.5 px-2 rounded-lg text-white/30" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            丢弃
                                        </button>
                                    </div>
                                )}
                                {/* Manual Summary + Settings */}
                                <div className="flex gap-1.5 mt-2">
                                    <button
                                        type="button"
                                        onClick={onRequestSummary}
                                        disabled={isSummaryGenerating || !canManualSummary}
                                        className="flex-1 text-[10px] py-1.5 rounded-lg transition-colors disabled:opacity-30"
                                        style={{ background: 'rgba(255,107,157,0.15)', color: 'rgba(255,107,157,0.9)' }}
                                    >
                                        {isSummaryGenerating ? '生成中…' : '手动总结'}
                                    </button>
                                    <button type="button" onClick={onOpenSummarySettings} className="text-[10px] py-1.5 px-2 rounded-lg text-white/40" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                        ⚙
                                    </button>
                                </div>
                            </div>

                            {/* Remaining placeholders */}
                            <PlaceholderItem icon="📸" label="记忆印记" />
                            <PlaceholderItem icon="💭" label="心情读取" />
                            <PlaceholderItem icon="📷" label="取景框" />

                            {/* Divider */}
                            <div className="my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                            {/* Custom Icon */}
                            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">🎨</span>
                                        <span className="text-xs text-white/80 font-medium">悬浮球图标</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 text-[10px] py-1.5 rounded-lg transition-colors active:bg-white/10"
                                        style={{ background: 'rgba(255,107,157,0.15)', color: 'rgba(255,107,157,0.9)' }}
                                    >
                                        上传图片
                                    </button>
                                    {customIcon && (
                                        <button
                                            type="button"
                                            onClick={handleResetIcon}
                                            className="flex-1 text-[10px] py-1.5 rounded-lg text-white/40 transition-colors active:bg-white/10"
                                            style={{ background: 'rgba(255,255,255,0.06)' }}
                                        >
                                            恢复默认
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
});

TheaterFloatingBall.displayName = 'TheaterFloatingBall';

export default TheaterFloatingBall;
