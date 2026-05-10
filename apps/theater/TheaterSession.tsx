/**
 * TheaterSession — VN 风格对话场景（光与夜之恋）
 * 底部毛玻璃对话框 · 打字机效果 · 点击翻页 · Auto · Log
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { resolveTheaterBg } from '../../utils/db/theaterStore';
import type { CharacterProfile, UserProfile, Message, DirectorEvent, TheaterLocation, TimeSlot, LocationSuggestion } from '../../types';
import type { InnerWhisper } from '../../utils/thinkingExtractor';
import { TIME_SLOT_LABELS } from '../../types/theater';
import { useOS } from '../../context/OSContext';
import { useConfig } from '../../context/ConfigContext';
import { useTheaterBgm } from '../../hooks/useTheaterBgm';
import TheaterSettings from './TheaterSettings';
import TheaterFloatingBall from './TheaterFloatingBall';
import InlineLocationSheet from './InlineLocationSheet';



const REQUIRED_EMOTIONS = ['normal', 'happy', 'angry', 'sad', 'shy'];

interface TheaterSessionProps {
    char: CharacterProfile;
    userProfile: UserProfile;
    location: TheaterLocation;
    timeSlot: TimeSlot;
    is520: boolean;
    currentEvent: DirectorEvent | null;
    isDirectorLoading: boolean;
    isAiLoading: boolean;
    messages: Message[];
    onSendMessage: (text: string, directorHint?: string) => Promise<void>;
    /** Location switching (inline, no exit) */
    locations: TheaterLocation[];
    visitedLocationIds: string[];
    onSelectLocation: (loc: TheaterLocation) => void;
    onAddLocation: (loc: TheaterLocation) => void;
    onDeleteCustomLocation: (id: string) => void;
    showLocationSheet: boolean;
    onCloseLocationSheet: () => void;
    onOpenLocationSheet: () => void;
    onExit: () => void;
    // Inner Whispers (内心低语)
    activeWhispers?: InnerWhisper[];
    onWhisperClick?: (whisper: InnerWhisper) => void;
    // Timeline / Fork
    timelineLabel?: string;
    onForkFromMessage?: (msg: Message) => void;
    // Summary
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
    // Transition
    isTransitioning?: boolean;
    transitionLocationName?: string;
    // Director Location Suggestion
    pendingLocationSuggestion?: LocationSuggestion | null;
    onAcceptLocationSuggestion?: () => void;
    onDeclineLocationSuggestion?: () => void;
}

// ── Helpers ──

const cleanText = (text: string) => text.replace(/\[.*?\]/g, '').trim();

const extractCurrentEmotion = (messages: Message[]): string => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role !== 'assistant') continue;
        const lines = (messages[i].content || '').split('\n');
        for (let j = lines.length - 1; j >= 0; j--) {
            const match = lines[j].match(/^\[([a-zA-Z0-9_-]+)\]/);
            if (match) return match[1].toLowerCase();
        }
        break;
    }
    return 'normal';
};

/** Flatten messages into VN pages with type detection */
type PageType = 'dialogue' | 'narration' | 'user';
interface VNPage { role: 'user' | 'assistant'; type: PageType; text: string; msgId: string | number; }

/** Detect if a cleaned line is dialogue (wrapped in quotes) and strip the quotes */
function classifyLine(clean: string): { type: 'dialogue' | 'narration'; text: string } {
    // Match "..." or \u201C...\u201D or \u300C...\u300D
    const m = clean.match(/^["\u201C\u300C](.+)["\u201D\u300D]$/);
    if (m) return { type: 'dialogue', text: m[1] };
    // Partial match: starts with quote (AI sometimes doesn't close)
    const m2 = clean.match(/^["\u201C\u300C](.+)/);
    if (m2) return { type: 'dialogue', text: m2[1].replace(/["\u201D\u300D]$/, '') };
    return { type: 'narration', text: clean };
}

function buildPages(messages: Message[]): VNPage[] {
    const pages: VNPage[] = [];
    for (const msg of messages) {
        if (msg.role === 'user') {
            const clean = cleanText(msg.content);
            if (clean) pages.push({ role: 'user', type: 'user', text: clean, msgId: msg.id });
        } else {
            const lines = (msg.content || '').split('\n');
            for (const line of lines) {
                const clean = cleanText(line);
                if (!clean) continue;
                const { type, text } = classifyLine(clean);
                pages.push({ role: 'assistant', type, text, msgId: msg.id });
            }
        }
    }
    return pages;
}

// ── Typewriter Hook ──

function useTypewriter(text: string, speed = 30) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval>>();

    useEffect(() => {
        setDisplayed('');
        setDone(false);
        let idx = 0;
        timerRef.current = setInterval(() => {
            idx++;
            if (idx >= text.length) {
                setDisplayed(text);
                setDone(true);
                clearInterval(timerRef.current);
            } else {
                setDisplayed(text.slice(0, idx));
            }
        }, speed);
        return () => clearInterval(timerRef.current);
    }, [text, speed]);

    const skipToEnd = useCallback(() => {
        clearInterval(timerRef.current);
        setDisplayed(text);
        setDone(true);
    }, [text]);

    return { displayed, done, skipToEnd };
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

const TheaterSession: React.FC<TheaterSessionProps> = ({
    char, userProfile, location, timeSlot,
    is520: _is520, currentEvent, isDirectorLoading, isAiLoading,
    messages, onSendMessage,
    locations, visitedLocationIds,
    onSelectLocation, onAddLocation, onDeleteCustomLocation,
    showLocationSheet, onCloseLocationSheet, onOpenLocationSheet,
    onExit,
    timelineLabel, onForkFromMessage,
    isSummaryGenerating, hasPendingSummary, canManualSummary, canAutoSummary,
    summaryDisabledReason,
    onRequestSummary, onReviewPendingSummary, onDiscardPendingSummary,
    onToggleAutoSummary, onToggleAutoHideSummary, onChangeThreshold,
    onOpenSummarySettings,
    activeWhispers = [], onWhisperClick,
    isTransitioning, transitionLocationName,
    pendingLocationSuggestion, onAcceptLocationSuggestion, onDeclineLocationSuggestion,
}) => {
    const { addToast, registerBackHandler } = useOS();
    const { ttsConfig } = useConfig();

    // ── BGM ──
    const bgm = useTheaterBgm({
        location,
        timeSlot,
        event: currentEvent,
        apiKey: ttsConfig.apiKey || '',
        groupId: ttsConfig.groupId,
    });

    // ── VN State ──
    const pages = useMemo(() => buildPages(messages), [messages]);
    const [pageIndex, setPageIndex] = useState(0);
    const [showInput, setShowInput] = useState(false);
    const [autoMode, setAutoMode] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [hideDialog, setHideDialog] = useState(false);
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const autoTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const prevPagesLenRef = useRef(0);
    /** Track whether the component mounted with messages already present (i.e. resumed history) */
    const hadInitialMessagesRef = useRef(messages.length > 0);

    // ── Background Crossfade ──
    const [resolvedBg, setResolvedBg] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        resolveTheaterBg(location.bgImage).then(url => {
            if (!cancelled) setResolvedBg(url);
        });
        return () => { cancelled = true; };
    }, [location.bgImage]);

    const currentBg = resolvedBg
        ? `url(${resolvedBg}) center/cover`
        : location.bgGradient || '#111';
    const prevBgRef = useRef(currentBg);
    const [bgLayers, setBgLayers] = useState<{ front: string; back: string; transitioning: boolean }>({
        front: currentBg, back: '', transitioning: false,
    });

    useLayoutEffect(() => {
        if (currentBg !== prevBgRef.current) {
            // Start crossfade: old bg goes to back layer (fading out), new bg on front (fading in)
            setBgLayers({ front: currentBg, back: prevBgRef.current, transitioning: true });
            prevBgRef.current = currentBg;
            const t = setTimeout(() => setBgLayers(prev => ({ ...prev, back: '', transitioning: false })), 700);
            return () => clearTimeout(t);
        }
    }, [currentBg]);
    const hasInitializedRef = useRef(false);
    const timeLabel = TIME_SLOT_LABELS[timeSlot];

    const currentPage = pages[pageIndex] || null;
    const isLastPage = pageIndex >= pages.length - 1;
    const isLoading = isAiLoading || isDirectorLoading;

    // ── Typewriter ──
    const { displayed, done, skipToEnd } = useTypewriter(currentPage?.text || '', 30);

    // ── Page navigation: distinguish initial load vs new content ──
    useEffect(() => {
        if (pages.length === 0) return;

        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            if (hadInitialMessagesRef.current) {
                // Resumed session with existing history: jump to LAST page
                setPageIndex(pages.length - 1);
            } else {
                // Fresh session — first scene just generated: start from page 0
                setPageIndex(0);
            }
            prevPagesLenRef.current = pages.length;
        } else if (pages.length !== prevPagesLenRef.current) {
            // New content from AI: jump to first NEW page
            const firstNewIndex = Math.max(0, prevPagesLenRef.current);
            setPageIndex(firstNewIndex);
            setShowInput(false);
            prevPagesLenRef.current = pages.length;
        }
    }, [pages.length]);

    // ── Auto-play: advance page after typewriter finishes ──
    useEffect(() => {
        if (!autoMode || !done || isLoading) return;
        if (isLastPage) {
            // Wait a moment then show input
            autoTimerRef.current = setTimeout(() => setShowInput(true), 1500);
        } else {
            autoTimerRef.current = setTimeout(() => setPageIndex(i => i + 1), 2000);
        }
        return () => clearTimeout(autoTimerRef.current);
    }, [autoMode, done, isLastPage, isLoading, pageIndex]);

    // ── Sprite System ──
    const dateEmotionKeys = useMemo(
        () => [...REQUIRED_EMOTIONS, ...(char.customDateSprites || [])],
        [char.customDateSprites],
    );

    const activeSprites: Record<string, string> = useMemo(() => {
        if (char.activeSkinSetId && char.dateSkinSets) {
            const skin = char.dateSkinSets.find(s => s.id === char.activeSkinSetId);
            if (skin && Object.keys(skin.sprites).length > 0) return skin.sprites;
        }
        return char.sprites || {};
    }, [char.activeSkinSetId, char.dateSkinSets, char.sprites]);

    const spriteConfig = char.spriteConfig || { scale: 1, x: 0, y: 0 };
    const hasSprites = Object.keys(activeSprites).length > 0;
    const currentEmotion = extractCurrentEmotion(messages);
    const currentSprite = useMemo(() => {
        if (!hasSprites) return null;
        if (activeSprites[currentEmotion]) return activeSprites[currentEmotion];
        const found = dateEmotionKeys.find(k => currentEmotion.includes(k));
        if (found && activeSprites[found]) return activeSprites[found];
        return activeSprites['normal'] || Object.values(activeSprites)[0] || null;
    }, [currentEmotion, activeSprites, hasSprites, dateEmotionKeys]);



    // ── Back handler ──
    useEffect(() => {
        const unreg = registerBackHandler(() => {
            if (showLog) { setShowLog(false); return true; }
            if (showInput) { setShowInput(false); return true; }
            if (window.confirm('离开当前场景？')) onExit();
            return true;
        });
        return unreg;
    }, [showInput, showLog, registerBackHandler, onExit]);

    // ── Click to advance ──
    const handleDialogClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!done) { skipToEnd(); return; }
        if (isLastPage) { setShowInput(true); return; }
        setPageIndex(i => i + 1);
    }, [done, skipToEnd, isLastPage]);

    // ── Skip all remaining pages ──
    const handleSkipAll = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (pages.length > 0) {
            setPageIndex(pages.length - 1);
            skipToEnd();
        }
    }, [pages.length, skipToEnd]);

    // ── Send message ──
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const text = input.trim();
        setInput('');
        setShowInput(false);
        try { await onSendMessage(text); } catch { addToast('发送失败，请重试', 'error'); }
    };

    // ── Handle whisper click ──
    const handleWhisperSelect = (w: InnerWhisper) => {
        if (isLoading || !onWhisperClick) return;
        onWhisperClick(w);
    };

    // ── Quick punctuation insert ──
    const insertAtCursor = useCallback((before: string, after: string = '') => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const selectedText = val.slice(start, end);
        const inserted = before + selectedText + after;
        const newVal = val.slice(0, start) + inserted + val.slice(end);
        setInput(newVal);
        // Position cursor between before/after (or after 'before' if no 'after')
        requestAnimationFrame(() => {
            el.focus();
            const cursorPos = start + before.length + selectedText.length;
            el.setSelectionRange(cursorPos, cursorPos);
        });
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter or Cmd+Enter → send
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
        }
        // Plain Enter → newline (default behavior, no preventDefault)
    };

    // ── Toggle auto ──
    const toggleAuto = (e: React.MouseEvent) => {
        e.stopPropagation();
        setAutoMode(v => !v);
    };

    // ── Render ──
    return (
        <div className="h-full w-full relative bg-black overflow-hidden font-sans select-none flex flex-col">
            {/* Background — dual-layer crossfade */}
            {bgLayers.back && (
                <div
                    className="theater-bg-layer theater-bg-crossfade-out"
                    style={{ background: bgLayers.back }}
                />
            )}
            <div
                className={`theater-bg-layer ${bgLayers.transitioning ? 'theater-bg-crossfade-in' : ''}`}
                style={{ background: bgLayers.front }}
            />
            {/* Gradient mask — replaces old panel background */}
            <div className="theater-vn-gradient-mask" />

            {/* Character Sprite */}
            {hasSprites && currentSprite && (
                <div className="absolute inset-x-0 bottom-0 h-[85%] flex items-end justify-center pointer-events-none z-10 overflow-hidden">
                    <img
                        src={currentSprite}
                        alt={char.name}
                        className="max-h-full max-w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all duration-300 origin-bottom"
                        style={{ transform: `translate(${spriteConfig.x}%, ${spriteConfig.y}%) scale(${spriteConfig.scale})` }}
                    />
                </div>
            )}

            {/* ════════ Transition Overlay ════════ */}
            {isTransitioning && (
                <div className="theater-transition-overlay">
                    <div className="theater-transition-content">
                        <div className="theater-transition-line" />
                        <div className="theater-transition-location">{transitionLocationName}</div>
                        <div className="theater-transition-sub">场景切换中</div>
                        <div className="theater-transition-line" />
                    </div>
                </div>
            )}

            {/* Top Bar — minimal */}
            <div className="relative z-50 flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
                <button onClick={onExit} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgba(255,255,255,0.6)" width={16} height={16}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-white/30 text-[11px] font-medium tracking-wide">{location.name}</span>
                    {timelineLabel && (
                        <span className="text-emerald-400/40 text-[10px] font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={10} height={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
                            {timelineLabel}
                        </span>
                    )}
                    <div className="theater-time-badge" style={{ padding: '4px 10px', fontSize: 11 }}>
                        <span>{timeLabel.icon}</span>
                        <span>{timeLabel.zh}</span>
                    </div>
                </div>
            </div>



            {/* ════════ VN Dialog Box — borderless ════════ */}
            {!showInput && (
                <div className={`theater-vn-dialog ${hideDialog ? 'dialog-hidden' : ''}`} onClick={handleDialogClick}>
                    {/* Name tag — simple floating text */}
                    {currentPage && currentPage.type !== 'narration' && (
                        <div className={`theater-vn-name-tag ${currentPage.type === 'user' ? 'user' : ''}`}>
                            {currentPage.type === 'user' ? (userProfile.name || '你') : char.name}
                        </div>
                    )}

                    {/* Text area */}
                    {isLoading ? (
                        <div className="theater-vn-loading">
                            <div className="theater-vn-loading-dots">
                                <span /><span /><span />
                            </div>
                            <span className="theater-vn-loading-label">
                                {isDirectorLoading ? '导演编排中…' : `${char.name}…`}
                            </span>
                        </div>
                    ) : currentPage ? (
                        <div className={`theater-vn-text ${currentPage.type}`}>
                            {currentPage.type === 'dialogue' && <span className="theater-vn-quote-mark open">{'\u201C'}</span>}
                            {displayed}
                            {!done && <span className="theater-vn-cursor" />}
                            {currentPage.type === 'dialogue' && done && <span className="theater-vn-quote-mark close">{'\u201D'}</span>}
                        </div>
                    ) : (
                        <div className="theater-vn-text" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            点击屏幕开始对话…
                        </div>
                    )}

                    {/* Click to continue indicator */}
                    {done && !isLoading && !isLastPage && (
                        <div className="theater-vn-ctc">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" width={12} height={12}>
                                <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
                            </svg>
                        </div>
                    )}

                    {/* End of conversation → tap hint */}
                    {done && !isLoading && isLastPage && pages.length > 0 && activeWhispers.length === 0 && (
                        <div className="theater-vn-ctc" style={{ fontSize: 10, letterSpacing: 2 }}>
                            点击回复
                        </div>
                    )}

                    {/* Inner Whispers — Glassmorphism floating options */}
                    {done && !isLoading && isLastPage && activeWhispers.length > 0 && (
                        <div className="theater-vn-whispers" onClick={e => e.stopPropagation()}>
                            {activeWhispers.map((w, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleWhisperSelect(w)}
                                    className="theater-vn-whisper-btn"
                                    style={{ animationDelay: `${i * 150}ms` }}
                                >
                                    <span className="theater-vn-whisper-text">{w.whisper}</span>
                                    {w.tone && <span className="theater-vn-whisper-tone">{w.tone}</span>}
                                </button>
                            ))}
                            <button
                                className="theater-vn-whisper-free"
                                onClick={() => setShowInput(true)}
                                style={{ animationDelay: `${activeWhispers.length * 150}ms` }}
                            >
                                <span>✨ 自由输入…</span>
                            </button>
                        </div>
                    )}

                    {/* Director Location Suggestion Card */}
                    {pendingLocationSuggestion && !isLoading && done && isLastPage && (
                        <div className="theater-vn-location-suggest" onClick={e => e.stopPropagation()}>
                            <div className="theater-vn-suggest-header">
                                <span className="theater-vn-suggest-icon">🚶</span>
                                <span className="theater-vn-suggest-label">
                                    想带你去 → {pendingLocationSuggestion.name}
                                </span>
                            </div>
                            <div className="theater-vn-suggest-actions">
                                <button
                                    className="theater-vn-suggest-accept"
                                    onClick={onAcceptLocationSuggestion}
                                >
                                    跟他走
                                </button>
                                <button
                                    className="theater-vn-suggest-decline"
                                    onClick={onDeclineLocationSuggestion}
                                >
                                    再待会儿
                                </button>
                            </div>
                        </div>
                    )}


                    {/* Bottom Control Bar */}
                    <div className="theater-vn-controls" onClick={e => e.stopPropagation()}>
                        <button className="theater-vn-ctrl-btn" onClick={(e) => { e.stopPropagation(); setShowLog(true); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                            <span>回顾</span>
                        </button>
                        <button className="theater-vn-ctrl-btn" onClick={(e) => { e.stopPropagation(); setHideDialog(true); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                            <span>隐藏</span>
                        </button>
                        <button className="theater-vn-ctrl-btn" onClick={handleSkipAll}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" /></svg>
                            <span>跳过</span>
                        </button>
                        <button className={`theater-vn-ctrl-btn ${autoMode ? 'active' : ''}`} onClick={toggleAuto}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                            <span>自动</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Tap to restore dialog when hidden */}
            {hideDialog && (
                <div
                    className="absolute inset-0 z-30 cursor-pointer"
                    onClick={() => setHideDialog(false)}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                />
            )}

            {/* ════════ Input Area ════════ */}
            {showInput && (
                <div className="theater-vn-input-area" onClick={e => e.stopPropagation()}>
                    {/* Quick punctuation toolbar */}
                    <div className="theater-vn-punct-bar">
                        <button
                            className="theater-vn-punct-btn theater-vn-punct-hero"
                            onClick={() => insertAtCursor('\u201C', '\u201D')}
                            title="插入台词引号"
                        >
                            <span className="theater-vn-punct-icon">{'\u201C\u201D'}</span>
                            <span className="theater-vn-punct-label">台词</span>
                        </button>
                        <button
                            className="theater-vn-punct-btn"
                            onClick={() => insertAtCursor('\u2026\u2026')}
                            title="插入省略号"
                        >
                            <span className="theater-vn-punct-icon">……</span>
                        </button>
                        <button
                            className="theater-vn-punct-btn"
                            onClick={() => insertAtCursor('\u2014\u2014')}
                            title="插入破折号"
                        >
                            <span className="theater-vn-punct-icon">——</span>
                        </button>
                        <span className="theater-vn-punct-hint">引号内 = 台词 · 其余 = 动作</span>
                    </div>
                    <div className="theater-vn-input-row">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => {
                                setInput(e.target.value);
                                // Auto-grow height
                                const el = e.target;
                                el.style.height = '44px';
                                el.style.height = Math.min(el.scrollHeight, 100) + 'px';
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={isLoading ? '等待回应…' : '说了什么，做了什么…'}
                            disabled={isLoading}
                            autoFocus
                        />
                        <button
                            className="theater-vn-send-btn"
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={20} height={20}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={() => setShowInput(false)}
                        style={{ width: '100%', marginTop: 10, padding: '7px 0', fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer', letterSpacing: 1, fontWeight: 400 }}
                    >
                        ▾ 返回对话
                    </button>
                </div>
            )}

            {/* ════════ History Log ════════ */}
            {showLog && (
                <div className="theater-vn-log-overlay">
                    <div className="theater-vn-log-header">
                        <span className="theater-vn-log-title">对话记录</span>
                        <button className="theater-vn-log-close" onClick={() => setShowLog(false)}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={16} height={16}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="theater-vn-log-scroll">
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className="theater-vn-log-item"
                                onContextMenu={(e) => {
                                    if (onForkFromMessage) {
                                        e.preventDefault();
                                        onForkFromMessage(msg);
                                    }
                                }}
                            >
                                <div className={`theater-vn-log-item-name ${msg.role === 'user' ? 'user' : ''}`}>
                                    {msg.role === 'user' ? (userProfile.name || '你') : char.name}
                                </div>
                                <div className="theater-vn-log-item-text">{cleanText(msg.content)}</div>
                                {onForkFromMessage && (
                                    <button
                                        className="theater-vn-log-fork-btn"
                                        onClick={(e) => { e.stopPropagation(); onForkFromMessage(msg); }}
                                        title="从这里分叉"
                                    >
                                        <span style={{ fontSize: 9, letterSpacing: 0.5 }}>分叉</span>
                                    </button>
                                )}
                            </div>
                        ))}
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', paddingTop: 40, fontSize: 13 }}>
                                暂无对话记录
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Overlay */}
            <TheaterSettings
                char={char}
                location={location}
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Floating Ball */}
            <TheaterFloatingBall
                charId={char.id}
                onOpenSettings={() => setShowSettings(true)}
                onOpenFullLocationSheet={onOpenLocationSheet}
                bgmStatus={bgm.status}
                bgmEnabled={bgm.enabled}
                bgmVolume={bgm.volume}
                onBgmToggle={bgm.toggle}
                onBgmVolumeChange={bgm.setVolume}
                onBgmRegenerate={bgm.regenerate}
                isSummaryGenerating={isSummaryGenerating}
                hasPendingSummary={hasPendingSummary}
                canManualSummary={canManualSummary}
                canAutoSummary={canAutoSummary}
                summaryDisabledReason={summaryDisabledReason}
                onRequestSummary={onRequestSummary}
                onReviewPendingSummary={onReviewPendingSummary}
                onDiscardPendingSummary={onDiscardPendingSummary}
                onToggleAutoSummary={onToggleAutoSummary}
                onToggleAutoHideSummary={onToggleAutoHideSummary}
                onChangeThreshold={onChangeThreshold}
                onOpenSummarySettings={onOpenSummarySettings}
                theaterSummaryAutoEnabled={char.theaterSummaryAutoEnabled}
                theaterSummaryAutoHideEnabled={char.theaterSummaryAutoHideEnabled}
                theaterSummaryAutoThreshold={char.theaterSummaryAutoThreshold}
            />

            {/* Inline Location Sheet */}
            <InlineLocationSheet
                isOpen={showLocationSheet}
                onClose={onCloseLocationSheet}
                locations={locations}
                currentLocationId={location.id}
                visitedLocationIds={visitedLocationIds}
                timeSlot={timeSlot}
                onSelectLocation={onSelectLocation}
                onAddLocation={onAddLocation}
                onDeleteCustomLocation={onDeleteCustomLocation}
            />
        </div>
    );
};

export default TheaterSession;
