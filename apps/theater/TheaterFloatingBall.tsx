/**
 * TheaterFloatingBall — 520约会剧场独立悬浮球
 * 粉色系主题，不与见面的 SummaryFloatingBall 耦合。
 * 实装：场景切换、设置入口、氛围 BGM
 * 占位：记忆印记、心情读取、取景框
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, AnimatePresence, PanInfo } from 'framer-motion';

const DEFAULT_BALL_ICON = '/theater-ball-default.png';
const ICON_STORAGE_PREFIX = 'theater_ball_icon_';
const ICON_MAX_SIZE = 192; // resize uploaded images to 192x192 (high-DPI clarity for 56px ball)



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
            resolve(canvas.toDataURL('image/webp', 0.92));
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
    onOpenSettings: () => void;
    /** Location — open full sheet */
    onOpenFullLocationSheet: () => void;
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

const BALL_SIZE = 56;
const EDGE_PADDING = 10;

/* ── Handheld device color tokens ── */
const P = {
    // Shell (outer casing) — cream plastic feel
    shell: 'linear-gradient(155deg, #FFF0F3 0%, #FFE0EA 25%, #FFD1DC 55%, #FFC5D3 80%, #FFB8CC 100%)',
    shellBorder: 'rgba(210,140,165,0.7)',
    shellHighlight: 'rgba(255,255,255,0.7)',
    shellInnerShadow: 'inset 0 2px 10px rgba(200,110,140,0.18), inset 0 -2px 6px rgba(255,255,255,0.7), inset 2px 0 6px rgba(255,255,255,0.3), inset -2px 0 6px rgba(200,130,160,0.08)',
    shellEdge: '0 1px 0 rgba(255,255,255,0.8), inset 0 0 0 1px rgba(255,255,255,0.25)',
    // Screen (inner display) — inset cream white
    screenBg: 'linear-gradient(180deg, #FFFBFC 0%, #FFF5F8 40%, #FFF0F4 100%)',
    screenBorder: 'rgba(190,130,155,0.45)',
    screenInnerShadow: 'inset 0 2px 8px rgba(170,100,130,0.18), inset 0 0 4px rgba(180,120,150,0.1)',
    screenPixelGrid: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,200,220,0.06) 3px, rgba(255,200,220,0.06) 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,200,220,0.06) 3px, rgba(255,200,220,0.06) 4px)',
    // Status bar
    statusBg: 'linear-gradient(180deg, rgba(255,215,230,0.7) 0%, rgba(255,225,238,0.5) 100%)',
    // Buttons — jelly press feel
    cardBg: 'linear-gradient(180deg, rgba(255,235,245,0.7) 0%, rgba(255,218,232,0.5) 100%)',
    cardHover: 'rgba(255,200,220,0.7)',
    cardBorder: 'rgba(255,165,190,0.45)',
    cardInnerShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 2px rgba(200,130,160,0.12)',
    cardPressShadow: 'inset 0 2px 4px rgba(200,130,160,0.2), inset 0 1px 2px rgba(180,100,130,0.1)',
    textPri: '#5A3040', textSec: '#B08090', accent: '#D4607A',
    btnPink: '#FF7AA2', btnPinkBg: 'rgba(255,122,162,0.15)',
    btnPinkSolid: 'linear-gradient(135deg, #FF8FAB 0%, #FF6B95 100%)',
    toggleOn: '#FFB7C5', toggleOff: 'rgba(200,180,190,0.3)',
    divider: 'rgba(255,143,171,0.18)',
    // Shadows — thicker device shadow
    deviceShadow: '0 14px 44px rgba(190,90,130,0.28), 0 6px 16px rgba(255,143,171,0.22), 0 2px 4px rgba(200,120,150,0.15)',
    btnShadow: '0 2px 6px rgba(200,100,140,0.15)',
    // Lock card
    lockBg: 'rgba(255,230,240,0.55)',
    lockBorder: 'rgba(255,175,200,0.35)',
    lockText: 'rgba(170,110,140,0.65)',
    // Control module
    moduleBg: 'linear-gradient(180deg, rgba(255,238,245,0.6) 0%, rgba(255,225,238,0.4) 100%)',
    moduleBorder: 'rgba(255,170,195,0.35)',
} as const;

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



const TheaterFloatingBall: React.FC<TheaterFloatingBallProps> = memo(({
    charId,
    onOpenSettings,
    onOpenFullLocationSheet,
    bgmStatus, bgmEnabled, bgmVolume,
    onBgmToggle, onBgmVolumeChange, onBgmRegenerate: _onBgmRegenerate,
    isSummaryGenerating, hasPendingSummary, canManualSummary, canAutoSummary,
    summaryDisabledReason,
    onRequestSummary, onReviewPendingSummary, onDiscardPendingSummary,
    onToggleAutoSummary, onToggleAutoHideSummary, onChangeThreshold: _onChangeThreshold,
    onOpenSummarySettings: _onOpenSummarySettings,
    theaterSummaryAutoEnabled, theaterSummaryAutoHideEnabled, theaterSummaryAutoThreshold: _theaterSummaryAutoThreshold,
}) => {
    const storageKey = `theater_ball_pos_${charId}`;
    const iconKey = `${ICON_STORAGE_PREFIX}${charId}`;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const constraintsRef = useRef<HTMLDivElement>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [position, setPosition] = useState(() => readPos(storageKey) || defaultPos());
    const [dragging, setDragging] = useState(false);
    const [memoryExpanded, setMemoryExpanded] = useState(false);
    const [stickerOpen, setStickerOpen] = useState(false);

    // Responsive panel width: narrower, like a mini phone device
    const panelWidth = useMemo(() => {
        const w = typeof window !== 'undefined' ? window.innerWidth : 375;
        return Math.max(220, Math.min(260, Math.round(w * 0.58)));
    }, []);

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

                <style>{`
                  @keyframes theater-irregular-glow {
                    0%, 100% { filter: drop-shadow(0 0 6px rgba(255,154,187,0.6)) drop-shadow(0 0 14px rgba(255,107,157,0.3)); }
                    50% { filter: drop-shadow(0 0 10px rgba(255,154,187,0.9)) drop-shadow(0 0 22px rgba(255,107,157,0.5)); }
                  }
                  @keyframes heart-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                  }
                `}</style>
                {/* Ball — irregular shape, no clipping */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (!dragging) setPanelOpen(v => !v); }}
                    className={`relative flex items-center justify-center transition-all active:scale-90 ${dragging ? 'opacity-60' : 'opacity-100'}`}
                    style={{
                        width: BALL_SIZE,
                        height: BALL_SIZE,
                        animation: 'theater-irregular-glow 3s ease-in-out infinite',
                        background: 'transparent',
                    }}
                >
                    {/* Core — irregular transparent PNG, no border/clip */}
                    <img
                        src={ballIconUrl}
                        alt=""
                        className="w-full h-full object-contain"
                        draggable={false}
                        style={{ pointerEvents: 'none' }}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </button>
            </motion.div>

                {/* ═══ Handheld Device Panel — Fixed Center ═══ */}
                <AnimatePresence>
                {panelOpen && (
                    <motion.div
                        key="theater-panel-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            paddingTop: '12vh',
                            zIndex: 1001,
                            pointerEvents: 'none',
                        }}
                    >
                    <motion.div
                        initial={{ scale: 0.88, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.88, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                        style={{
                            width: panelWidth,
                            maxHeight: '60vh',
                            overflow: 'visible',
                            pointerEvents: 'auto',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ▸ LAYER 1: Device Shell (outer casing) */}
                        <div style={{
                            background: P.shell,
                            borderRadius: 28,
                            border: `2.5px solid ${P.shellBorder}`,
                            boxShadow: `${P.deviceShadow}, ${P.shellInnerShadow}, ${P.shellEdge}`,
                            padding: '10px 8px 10px',
                            position: 'relative',
                        }}>
                            {/* Shell top highlight — cream plastic reflection */}
                            <div style={{
                                position: 'absolute', top: 4, left: 16, right: 16, height: 3,
                                borderRadius: 2, background: `linear-gradient(90deg, transparent 0%, ${P.shellHighlight} 30%, ${P.shellHighlight} 70%, transparent 100%)`, opacity: 0.8,
                            }} />
                            {/* Shell left edge highlight */}
                            <div style={{
                                position: 'absolute', top: 24, left: 2, bottom: 24, width: 2.5,
                                borderRadius: 2, background: 'rgba(255,255,255,0.35)',
                            }} />
                            {/* Bow decoration — small hanging ornament */}
                            <img src="/theater-panel-bow.png" alt="" draggable={false} style={{
                                position: 'absolute', top: -14, left: 4, width: 28, height: 'auto',
                                pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(255,143,171,0.25))',
                                zIndex: 2, opacity: 0.8,
                            }} />
                            {/* Close side-key — small round button, top right */}
                            <button type="button" onClick={() => setPanelOpen(false)} style={{
                                position: 'absolute', top: -6, right: -5, zIndex: 3,
                                width: 22, height: 22, border: '2px solid rgba(255,155,180,0.5)',
                                borderRadius: '50%', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(145deg, #FFC4D4 0%, #FF8FAB 50%, #FF6B95 100%)',
                                boxShadow: '0 2px 8px rgba(255,107,149,0.3), inset 0 1px 2px rgba(255,255,255,0.35)',
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#fff" width={9} height={9}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* ▸ LAYER 2: Screen area (inset cream display) */}
                            <div style={{
                                background: P.screenBg,
                                backgroundImage: P.screenPixelGrid,
                                borderRadius: 16,
                                border: `1.5px solid ${P.screenBorder}`,
                                boxShadow: P.screenInnerShadow,
                                padding: '0 0 8px',
                                marginTop: 6,
                                overflow: 'hidden',
                            }}>
                                {/* ── LCD Screen Display ── */}
                                <div style={{
                                    margin: '8px 8px 0', borderRadius: 12, padding: '10px 12px 9px',
                                    background: 'linear-gradient(180deg, #FEFCFD 0%, #FFF8FA 50%, #FFF3F7 100%)',
                                    border: `1.5px solid rgba(200,150,170,0.3)`,
                                    boxShadow: 'inset 0 2px 6px rgba(180,110,140,0.12), inset 0 -1px 3px rgba(255,255,255,0.6), inset 1px 0 3px rgba(255,255,255,0.3)',
                                    backgroundImage: P.screenPixelGrid,
                                    position: 'relative',
                                }}>
                                    {/* Scanline overlay */}
                                    <div style={{ position:'absolute', inset:0, borderRadius:12, background:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(220,180,200,0.03) 2px, rgba(220,180,200,0.03) 3px)', pointerEvents:'none' }}/>
                                    <div style={{ textAlign:'center', fontSize:10, fontWeight:800, color:P.accent, letterSpacing:2.5, marginBottom:4 }}>
                                        LOVE REMOTE
                                    </div>
                                    <div style={{ textAlign:'center', fontSize:8, color:P.textSec, letterSpacing:0.8, marginBottom:3 }}>
                                        ♡ 恋爱控制器
                                    </div>
                                    <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${P.divider}, transparent)`, margin:'4px 0' }}/>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <span style={{ fontSize:7, color:P.textSec, letterSpacing:0.3 }}>
                                            {bgmStatus === 'generating' ? '♫ 生成心动频率…' : bgmStatus === 'ready' ? '♫ 心动频率播放中' : bgmEnabled ? '♫ 等待心动…' : '♫ 心动频率已静音'}
                                        </span>
                                        <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                                            <span style={{ fontSize:7, color:P.textSec }}>520</span>
                                            <svg width="14" height="8" viewBox="0 0 18 10" fill="none">
                                                <rect x="0.5" y="0.5" width="14" height="9" rx="2" stroke={P.accent} strokeWidth="1"/>
                                                <rect x="15" y="3" width="2" height="4" rx="0.5" fill={P.accent} opacity="0.5"/>
                                                <rect x="2" y="2" width="9" height="6" rx="1" fill={P.btnPink} opacity="0.7"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* ── 2×2 Jelly Keys ── */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 8px 6px' }}>
                                    {[
                                        { icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                                                <circle cx="12" cy="12" r="3"/>
                                            </svg>
                                        ), label: '场景', onClick: () => { setPanelOpen(false); onOpenFullLocationSheet(); } },
                                        { icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.38 3.46 16 2 12 4 8 2 3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6l-1 12h14l-1-12h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                                            </svg>
                                        ), label: '立绘', onClick: () => { setPanelOpen(false); onOpenSettings(); } },
                                        { icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                                            </svg>
                                        ), label: '音乐', onClick: () => onBgmToggle(), active: bgmEnabled },
                                        { icon: (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/>
                                            </svg>
                                        ), label: '记忆', onClick: () => setMemoryExpanded(v => !v), active: memoryExpanded },
                                    ].map(item => (
                                        <button key={item.label} type="button" onClick={item.onClick}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                justifyContent: 'center', gap: 3, padding: '9px 4px',
                                                borderRadius: 12,
                                                background: item.active
                                                    ? 'linear-gradient(180deg, rgba(255,190,210,0.6) 0%, rgba(255,160,190,0.4) 100%)'
                                                    : 'linear-gradient(180deg, rgba(255,240,248,0.8) 0%, rgba(255,225,238,0.5) 100%)',
                                                border: `1.5px solid ${item.active ? 'rgba(255,120,162,0.5)' : 'rgba(255,175,200,0.4)'}`,
                                                boxShadow: item.active
                                                    ? P.cardPressShadow
                                                    : `0 3px 6px rgba(200,110,140,0.12), ${P.cardInnerShadow}`,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                transform: item.active ? 'translateY(1px)' : 'none',
                                            }}
                                            onMouseDown={e => {
                                                e.currentTarget.style.transform = 'scale(0.93) translateY(1px)';
                                                e.currentTarget.style.boxShadow = P.cardPressShadow;
                                            }}
                                            onMouseUp={e => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = `0 3px 6px rgba(200,110,140,0.12), ${P.cardInnerShadow}`;
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = `0 3px 6px rgba(200,110,140,0.12), ${P.cardInnerShadow}`;
                                            }}>
                                            {item.icon}
                                            <span style={{ fontSize: 9, fontWeight: 700, color: P.textPri, letterSpacing: 0.8 }}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* ── Memory Sub-Panel (collapsible, animated) ── */}
                                <AnimatePresence>
                                {memoryExpanded && (
                                    <motion.div
                                        key="memory-sub-panel"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                                        style={{ overflow: 'hidden', padding: '0 10px' }}
                                    >
                                        <div style={{
                                            borderRadius: 10, padding: '7px 8px 6px', marginBottom: 4,
                                            background: P.moduleBg, border: `1px solid ${P.moduleBorder}`,
                                            boxShadow: 'inset 0 1px 2px rgba(200,140,170,0.06), inset 0 -1px 0 rgba(255,255,255,0.4)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={P.accent} strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>
                                                <span style={{ fontSize: 8, color: P.textPri, fontWeight: 700 }}>记忆整理</span>
                                            </div>
                                            {/* Toggle: 自动总结 */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 8, color: P.textPri, fontWeight: 500 }}>自动总结</span>
                                                {canAutoSummary ? (
                                                    <button type="button" onClick={() => onToggleAutoSummary?.(!theaterSummaryAutoEnabled)}
                                                        style={{ width: 30, height: 16, borderRadius: 8, background: theaterSummaryAutoEnabled ? P.toggleOn : P.toggleOff, border: 'none', cursor: 'pointer', position: 'relative' }}>
                                                        <span style={{ position: 'absolute', top: 1.5, left: theaterSummaryAutoEnabled ? 15 : 1.5, width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                                                    </button>
                                                ) : <span style={{ fontSize: 7, color: P.textSec }}>{summaryDisabledReason || '需副API'}</span>}
                                            </div>
                                            {/* Toggle: 旧回忆收纳 */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                                <span style={{ fontSize: 8, color: P.textSec, fontWeight: 500 }}>旧回忆收纳</span>
                                                <button type="button" onClick={() => onToggleAutoHideSummary?.(!theaterSummaryAutoHideEnabled)}
                                                    style={{ width: 30, height: 16, borderRadius: 8, background: theaterSummaryAutoHideEnabled ? P.toggleOn : P.toggleOff, border: 'none', cursor: 'pointer', position: 'relative' }}>
                                                    <span style={{ position: 'absolute', top: 1.5, left: theaterSummaryAutoHideEnabled ? 15 : 1.5, width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                                                </button>
                                            </div>
                                            {hasPendingSummary && (
                                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                                    <button type="button" onClick={onReviewPendingSummary} style={{ flex: 1, fontSize: 8, padding: '3px 0', borderRadius: 6, background: 'rgba(255,183,197,0.15)', color: P.btnPink, border: 'none', cursor: 'pointer', fontWeight: 600 }}>查看</button>
                                                    <button type="button" onClick={onDiscardPendingSummary} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 6, background: 'rgba(200,180,190,0.12)', color: P.textSec, border: 'none', cursor: 'pointer' }}>丢弃</button>
                                                </div>
                                            )}
                                            {/* Primary action */}
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <button type="button" onClick={onRequestSummary} disabled={isSummaryGenerating || !canManualSummary}
                                                    style={{ width: '78%', fontSize: 9, padding: '5px 0', borderRadius: 10,
                                                        background: P.btnPinkSolid, color: '#fff', border: 'none', cursor: 'pointer',
                                                        fontWeight: 700, opacity: (isSummaryGenerating || !canManualSummary) ? 0.35 : 1,
                                                        boxShadow: '0 2px 6px rgba(255,107,149,0.25)' }}>
                                                    {isSummaryGenerating ? '整理中…' : '✦ 立即整理'}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>

                                {/* ── Mini Player Strip ── */}
                                <div style={{ padding: '0 8px 6px' }}>
                                    <div style={{
                                        borderRadius: 9, padding: '5px 8px',
                                        background: 'linear-gradient(180deg, rgba(255,242,248,0.5) 0%, rgba(255,232,242,0.35) 100%)',
                                        border: `1px solid rgba(255,180,205,0.3)`,
                                        boxShadow: 'inset 0 1px 2px rgba(200,140,170,0.06), inset 0 -1px 0 rgba(255,255,255,0.4)',
                                        display: 'flex', alignItems: 'center', gap: 5,
                                    }}>
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill={P.btnPink} stroke="none"><path d="M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                                        <span style={{ flex: 1, fontSize: 7, color: P.textSec, fontStyle: 'italic', letterSpacing: 0.2 }}>
                                            {bgmStatus === 'generating' ? '♪ 生成中…' : bgmStatus === 'ready' ? '♡ 播放中' : bgmEnabled ? '♪ 等待…' : '♪ 已静音'}
                                        </span>
                                        <input type="range" min={0} max={100} value={Math.round(bgmVolume * 100)}
                                            onChange={e => onBgmVolumeChange(Number(e.target.value) / 100)}
                                            style={{ width: 40, height: 2, borderRadius: 2, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                                                background: `linear-gradient(to right, ${P.btnPink} ${bgmVolume * 100}%, ${P.toggleOff} ${bgmVolume * 100}%)`,
                                                accentColor: P.btnPink }} />
                                    </div>
                                </div>
                            </div>
                            {/* End Screen */}

                            {/* ── 贴纸仓 (Collapsible) ── */}
                            <div style={{
                                margin: '6px 6px 0', borderRadius: 12, overflow: 'hidden',
                                border: `1.5px solid rgba(255,180,205,0.3)`,
                                boxShadow: 'inset 0 1px 3px rgba(200,140,170,0.06), inset 0 -1px 0 rgba(255,255,255,0.5)',
                            }}>
                                <button type="button" onClick={() => setStickerOpen(v => !v)} style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 10px', cursor: 'pointer', border: 'none',
                                    background: 'linear-gradient(180deg, rgba(255,245,250,0.7) 0%, rgba(255,238,246,0.5) 100%)',
                                }}>
                                    <span style={{ fontSize: 11 }}>🖼</span>
                                    <span style={{ fontSize: 8, fontWeight: 700, color: P.textPri, flex: 1, textAlign: 'left' }}>贴纸仓</span>
                                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke={P.textSec} strokeWidth="2" style={{ transform: stickerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                        <path d="M2 4l4 4 4-4"/>
                                    </svg>
                                </button>
                                <AnimatePresence>
                                {stickerOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.18 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ padding: '6px 10px 8px', display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${P.divider}` }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                                                background: 'rgba(255,248,252,0.8)', border: `1px dashed ${P.cardBorder}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: 'inset 0 1px 2px rgba(200,140,170,0.06)',
                                            }}>
                                                <img src={ballIconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                                    style={{ flex: 1, padding: '3px 0', borderRadius: 7, fontSize: 8, fontWeight: 700,
                                                        background: P.btnPinkSolid, color: '#fff', border: 'none', cursor: 'pointer',
                                                        boxShadow: '0 1px 3px rgba(255,107,149,0.2)' }}>
                                                    换一张
                                                </button>
                                                {customIcon && (
                                                    <button type="button" onClick={handleResetIcon}
                                                        style={{ padding: '3px 6px', borderRadius: 7, fontSize: 8,
                                                            background: 'rgba(255,245,250,0.6)', color: P.textSec, border: `1px solid ${P.divider}`, cursor: 'pointer' }}>
                                                        重置
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>

                            {/* ▸ Home Key — physical device button */}
                            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 2 }}>
                                <button type="button" onClick={() => setPanelOpen(false)}
                                    style={{
                                        width: 30, height: 30, borderRadius: '50%',
                                        background: 'linear-gradient(160deg, #FFF3F6 0%, #FFE8EF 30%, #FFD8E4 70%, #FFD0DE 100%)',
                                        border: `2px solid rgba(210,140,165,0.55)`,
                                        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 3px rgba(200,130,160,0.18), 0 2px 6px rgba(200,120,150,0.2), 0 0 0 3px rgba(255,200,220,0.15)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        animation: 'heart-float 2.5s ease-in-out infinite',
                                    }}
                                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(200,130,160,0.25), 0 1px 2px rgba(200,120,150,0.1)'; }}
                                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 3px rgba(200,130,160,0.18), 0 2px 6px rgba(200,120,150,0.2), 0 0 0 3px rgba(255,200,220,0.15)'; }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={P.btnPink} width={13} height={13}>
                                        <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                    </motion.div>
                )}
                </AnimatePresence>
        </div>
    );
});

TheaterFloatingBall.displayName = 'TheaterFloatingBall';

export default TheaterFloatingBall;
