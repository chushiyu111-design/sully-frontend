import React,{ memo,useEffect,useMemo,useRef,useState } from 'react';
import { motion,useMotionValue,PanInfo } from 'framer-motion';
import { GearSix,NotePencil,X,WarningCircle } from '@phosphor-icons/react';
import { CharacterProfile } from '../../types';
import { DATE_DEFAULT_WORD_COUNT } from '../../utils/datePrompts';
import WritingStyleSheet, { getStyleDisplayLabel } from './WritingStyleSheet';

interface SummaryFloatingBallProps {
    char: CharacterProfile;
    isGenerating: boolean;
    hasPendingSummary: boolean;
    canManualSummary: boolean;
    canAutoSummary: boolean;
    disabledReason?: string;
    onRequestManualSummary: () => void;
    onReviewPendingSummary: () => void;
    onDiscardPendingSummary: () => void;
    onToggleAutoSummary: (enabled: boolean) => void;
    onToggleAutoHideSummary: (enabled: boolean) => void;
    onChangeThreshold: (threshold: number) => void;
    onOpenSettings: () => void;
    // Output tuning
    wordCount?: number;
    writingStyle?: string;
    onChangeWordCount: (count: number | undefined) => void;
    onChangeWritingStyle: (style: string | undefined) => void;
    // Translation
    translationEnabled?: boolean;
    translateSourceLang?: string;
    translateTargetLang?: string;
    onToggleTranslation?: (enabled: boolean) => void;
    onSetTranslateSourceLang?: (lang: string) => void;
    onSetTranslateTargetLang?: (lang: string) => void;
}

const BALL_SIZE = 56;
const EDGE_PADDING = 12;
const DEFAULT_THRESHOLD = 20;
const SUMMARY_HEARTS_ICON = '/images/date-summary-hearts.png';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const readStoredPosition = (key: string) => {
    if (typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (!parsed || typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
        return parsed as { x: number; y: number };
    } catch {
        return null;
    }
};

const getDefaultPosition = () => {
    if (typeof window === 'undefined') return { x: 20, y: 160 };
    return {
        x: Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - 20),
        y: Math.max(EDGE_PADDING, Math.round(window.innerHeight * 0.58)),
    };
};

const SummaryFloatingBall: React.FC<SummaryFloatingBallProps> = memo(({
    char,
    isGenerating,
    hasPendingSummary,
    canManualSummary,
    canAutoSummary,
    disabledReason,
    onRequestManualSummary,
    onReviewPendingSummary,
    onDiscardPendingSummary,
    onToggleAutoSummary,
    onToggleAutoHideSummary,
    onChangeThreshold,
    onOpenSettings,
    wordCount,
    writingStyle,
    onChangeWordCount,
    onChangeWritingStyle,
    translationEnabled,
    translateSourceLang,
    translateTargetLang,
    onToggleTranslation,
    onSetTranslateSourceLang,
    onSetTranslateTargetLang,
}) => {
    const storageKey = `date_summary_ball_pos_${char.id}`;
    const constraintsRef = useRef<HTMLDivElement>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [styleSheetOpen, setStyleSheetOpen] = useState(false);
    const [position, setPosition] = useState(() => readStoredPosition(storageKey) || getDefaultPosition());
    const [dragging, setDragging] = useState(false);
    const x = useMotionValue(position.x);
    const y = useMotionValue(position.y);

    useEffect(() => {
        const next = readStoredPosition(storageKey) || getDefaultPosition();
        const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
        const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
        const clamped = {
            x: clamp(next.x, EDGE_PADDING, maxX),
            y: clamp(next.y, EDGE_PADDING, maxY),
        };
        setPosition(clamped);
        x.set(clamped.x);
        y.set(clamped.y);
    }, [char.id, storageKey, x, y]);

    useEffect(() => {
        const handleResize = () => {
            const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
            const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
            const clamped = {
                x: clamp(x.get(), EDGE_PADDING, maxX),
                y: clamp(y.get(), EDGE_PADDING, maxY),
            };
            setPosition(clamped);
            x.set(clamped.x);
            y.set(clamped.y);
            localStorage.setItem(storageKey, JSON.stringify(clamped));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [storageKey, x, y]);

    const panelPlacement = useMemo(() => {
        if (typeof window === 'undefined') return { horizontal: 'right' as const, vertical: 'down' as const };
        return {
            horizontal: position.x > window.innerWidth - 220 ? 'left' as const : 'right' as const,
            vertical: position.y > window.innerHeight - 260 ? 'up' as const : 'down' as const,
        };
    }, [position]);

    const panelStyle: React.CSSProperties = {
        left: panelPlacement.horizontal === 'right' ? BALL_SIZE + 10 : undefined,
        right: panelPlacement.horizontal === 'left' ? BALL_SIZE + 10 : undefined,
        top: panelPlacement.vertical === 'down' ? 0 : undefined,
        bottom: panelPlacement.vertical === 'up' ? 0 : undefined,
    };

    const commitPosition = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const maxX = Math.max(EDGE_PADDING, window.innerWidth - BALL_SIZE - EDGE_PADDING);
        const maxY = Math.max(EDGE_PADDING, window.innerHeight - BALL_SIZE - EDGE_PADDING);
        const next = {
            x: clamp(x.get(), EDGE_PADDING, maxX),
            y: clamp(y.get(), EDGE_PADDING, maxY),
        };
        setPosition(next);
        x.set(next.x);
        y.set(next.y);
        if (Math.hypot(info.offset.x, info.offset.y) >= 10) {
            localStorage.setItem(storageKey, JSON.stringify(next));
        }
        window.setTimeout(() => setDragging(false), 0);
    };

    const threshold = char.dateSummaryAutoThreshold || DEFAULT_THRESHOLD;
    const autoEnabled = !!char.dateSummaryAutoEnabled;
    const autoHideEnabled = !!char.dateSummaryAutoHideEnabled;

    const handleThresholdChange = (value: string) => {
        const next = clamp(parseInt(value || `${DEFAULT_THRESHOLD}`, 10), 4, 200);
        onChangeThreshold(next);
    };

    return (
        <div ref={constraintsRef} className="absolute inset-0 z-[90] pointer-events-none">
            <motion.div
                drag={!panelOpen}
                dragConstraints={constraintsRef}
                dragMomentum={false}
                dragElastic={0}
                style={{ x, y }}
                onDragStart={() => setDragging(true)}
                onDragEnd={commitPosition}
                className="absolute left-0 top-0 pointer-events-auto"
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!dragging) setPanelOpen(prev => !prev);
                    }}
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white transition-opacity active:scale-95 ${dragging ? 'opacity-70' : 'opacity-100'}`}
                    title="见面总结"
                >
                    <span className="absolute inset-1 rounded-full bg-white/25 blur-xl" />
                    <span className="absolute inset-2 rounded-full bg-lime-200/20 blur-2xl" />
                    <img
                        src={SUMMARY_HEARTS_ICON}
                        alt=""
                        aria-hidden="true"
                        className="relative h-14 w-14 scale-[1.55] object-contain drop-shadow-[0_0_14px_rgba(255,255,235,0.72)]"
                        draggable={false}
                    />
                    {hasPendingSummary && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.95)]" />}
                </button>

                {panelOpen && (
                    <div
                        className="control-panel absolute w-52 rounded-2xl border border-white/15 bg-black/65 p-3 text-white shadow-2xl backdrop-blur-2xl"
                        style={panelStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-bold">自动总结</div>
                                {!canAutoSummary && (
                                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/45">
                                        <WarningCircle size={11} />
                                        副 API 未配置
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                disabled={!canAutoSummary || isGenerating}
                                onClick={() => onToggleAutoSummary(!autoEnabled)}
                                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${autoEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                                title={!canAutoSummary ? '请配置副 API' : undefined}
                            >
                                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <label className="mb-3 flex items-center justify-between gap-2 text-[11px] text-white/70">
                            <span>每</span>
                            <input
                                type="number"
                                min={4}
                                max={200}
                                value={threshold}
                                disabled={isGenerating}
                                onChange={(e) => handleThresholdChange(e.target.value)}
                                className="h-8 w-16 rounded-xl border border-white/10 bg-white/10 px-2 text-center text-xs text-white outline-none focus:border-emerald-300/60"
                            />
                            <span>条触发</span>
                        </label>

                        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-2.5 py-2">
                            <div>
                                <div className="text-xs font-bold text-white/90">压缩旧记录</div>
                                <div className="mt-0.5 text-[10px] text-white/45">总结后收起较早原文</div>
                            </div>
                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => onToggleAutoHideSummary(!autoHideEnabled)}
                                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${autoHideEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                                title="总结后收起较早原文，保留最近发生的对话"
                            >
                                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoHideEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {hasPendingSummary && (
                            <div className="mb-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2">
                                <button
                                    type="button"
                                    onClick={onReviewPendingSummary}
                                    className="w-full rounded-lg py-1.5 text-xs font-bold text-emerald-200 active:bg-white/10"
                                >
                                    查看待确认总结
                                </button>
                                <button
                                    type="button"
                                    onClick={onDiscardPendingSummary}
                                    className="mt-1 w-full rounded-lg py-1 text-[11px] text-white/50 active:bg-white/10"
                                >
                                    丢弃
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={!canManualSummary || isGenerating}
                            onClick={onRequestManualSummary}
                            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-400/10 py-2 text-xs font-bold text-emerald-200 transition-colors active:bg-emerald-400/20 disabled:opacity-40"
                            title={!canManualSummary ? disabledReason : undefined}
                        >
                            <NotePencil size={15} />
                            {isGenerating ? '生成中...' : '手动总结'}
                        </button>

                        {/* --- Output Tuning: Word Count --- */}
                        <div className="mb-3 border-t border-white/10 pt-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[11px] font-bold text-white/80">回复字数</span>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min={30}
                                        max={2000}
                                        step={10}
                                        value={wordCount && wordCount > 0 ? wordCount : ''}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value, 10);
                                            onChangeWordCount(v > 0 ? v : undefined);
                                        }}
                                        placeholder={String(DATE_DEFAULT_WORD_COUNT)}
                                        className="h-7 w-16 rounded-lg border border-white/10 bg-white/10 px-2 text-center text-[11px] text-white outline-none focus:border-emerald-300/60 tabular-nums"
                                    />
                                    <span className="text-[10px] text-white/40">字</span>
                                </div>
                            </div>
                        </div>

                        {/* --- Output Tuning: Writing Style (compact) --- */}
                        <div className="mb-3">
                            <div className="text-[11px] font-bold text-white/80 mb-2">文风</div>
                            <button
                                type="button"
                                onClick={() => setStyleSheetOpen(true)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[11px] text-white/45">🖊</span>
                                    <span className={`text-[12px] font-bold truncate ${
                                        writingStyle ? 'text-emerald-300/85' : 'text-white/40'
                                    }`}>
                                        {getStyleDisplayLabel(writingStyle)}
                                    </span>
                                </div>
                                <span className="text-[10px] text-white/35 font-medium flex-shrink-0">切换 ›</span>
                            </button>
                        </div>

                        {/* --- Translation Toggle --- */}
                        <div className="mb-3 border-t border-white/10 pt-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="text-[11px] font-bold text-white/80">翻译</div>
                                <button
                                    type="button"
                                    onClick={() => onToggleTranslation?.(!translationEnabled)}
                                    className={`relative h-6 w-11 rounded-full transition-colors ${translationEnabled ? 'bg-sky-500' : 'bg-white/20'}`}
                                >
                                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${translationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {translationEnabled && (
                                <div className="space-y-2.5 animate-fade-in">
                                    <div>
                                        <div className="text-[10px] font-bold text-white/45 mb-1.5">选（原文语言）</div>
                                        <div className="flex flex-wrap gap-1">
                                            {['中文', 'English', '日本語', '한국어', 'Français', 'Español'].map(lang => (
                                                <button
                                                    key={`src-${lang}`}
                                                    type="button"
                                                    onClick={() => onSetTranslateSourceLang?.(lang)}
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${translateSourceLang === lang ? 'bg-white/25 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                                >
                                                    {lang}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-white/45 mb-1.5">译（翻译目标）</div>
                                        <div className="flex flex-wrap gap-1">
                                            {['中文', 'English', '日本語', '한국어', 'Français', 'Español'].map(lang => (
                                                <button
                                                    key={`tgt-${lang}`}
                                                    type="button"
                                                    onClick={() => onSetTranslateTargetLang?.(lang)}
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${translateTargetLang === lang ? 'bg-sky-500/80 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                                >
                                                    {lang}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-center text-white/35 bg-white/5 rounded-lg py-1.5">
                                        选<span className="font-bold text-white/70">{translateSourceLang || '?'}</span>{' '}译<span className="font-bold text-sky-300/80">{translateTargetLang || '?'}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setPanelOpen(false);
                                onOpenSettings();
                            }}
                            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-xs text-white/80 transition-colors active:bg-white/15"
                        >
                            <GearSix size={15} />
                            更多设置
                        </button>

                        <button
                            type="button"
                            onClick={() => setPanelOpen(false)}
                            className="flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] text-white/45 active:bg-white/10"
                        >
                            <X size={12} />
                            关闭
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Writing Style Sheet (secondary bottom sheet) */}
            <WritingStyleSheet
                isOpen={styleSheetOpen}
                currentStyle={writingStyle}
                onSelect={onChangeWritingStyle}
                onClose={() => setStyleSheetOpen(false)}
            />
        </div>
    );
});

SummaryFloatingBall.displayName = 'SummaryFloatingBall';

export default SummaryFloatingBall;
