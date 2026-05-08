/**
 * TrajectoryApp — 人生轨迹 主入口
 * 三视图：角色选择 → 时间轴 → 独白演出 + 窃语
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useOS } from '../context/OSContext';
import type { CharacterProfile } from '../types';
import type { TrajectoryNode, TrajectoryMood } from '../types/trajectory';
import { MOOD_COLORS } from '../types/trajectory';
import { getTrajectoryNodes, saveTrajectoryNode } from '../utils/db/trajectoryStore';
import {
    hasAnyMessages, initTrajectory, generateMonologue,
    generateAfterMonologue, generateWhisperResponse, createManualAfterNode,
} from '../utils/trajectoryEngine';
import { MinimaxTts } from '../utils/minimaxTts';
import { getTtsConfig } from '../utils/runtimeConfig';
import { withCharacterTtsVoice } from '../utils/characterTts';
import '../styles/trajectory.css';

type View = 'select' | 'timeline' | 'monologue';

const TrajectoryApp: React.FC = () => {
    const { closeApp, characters, apiConfig, addToast, userProfile } = useOS();
    const [view, setView] = useState<View>('select');
    const [char, setChar] = useState<CharacterProfile | null>(null);
    const [nodes, setNodes] = useState<TrajectoryNode[]>([]);
    const [activeNode, setActiveNode] = useState<TrajectoryNode | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [monoText, setMonoText] = useState('');
    const [isMonoGen, setIsMonoGen] = useState(false);
    const [whisperInput, setWhisperInput] = useState('');
    const [whisperResp, setWhisperResp] = useState('');
    const [isWhisperGen, setIsWhisperGen] = useState(false);
    const [showWhisper, setShowWhisper] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addKeywords, setAddKeywords] = useState('');
    const [showRegenConfirm, setShowRegenConfirm] = useState(false);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const api = apiConfig?.baseUrl && apiConfig?.apiKey && apiConfig?.model
        ? { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model } : null;

    // ── Character Selection ──
    const handleSelectChar = useCallback(async (c: CharacterProfile) => {
        if (!api) { addToast('请先配置主 API', 'error'); return; }
        const ok = await hasAnyMessages(c.id);
        if (!ok) { addToast(`还没和${c.name}聊过天，先去认识一下吧`, 'info'); return; }
        setChar(c);
        setIsLoading(true);
        setView('timeline');
        try {
            let existing = getTrajectoryNodes(c.id);
            if (existing.length === 0) {
                existing = await initTrajectory(c, api);
            }
            setNodes(existing);
        } catch (e: any) {
            console.error('[Trajectory] init failed:', e);
            addToast('轨迹生成失败: ' + (e.message || e), 'error');
            setView('select');
        } finally {
            setIsLoading(false);
        }
    }, [api, addToast]);

    // ── Open Node ──
    const handleOpenNode = useCallback(async (node: TrajectoryNode) => {
        if (!char || !api) return;
        setActiveNode(node);
        setView('monologue');
        setShowWhisper(false);
        setWhisperResp('');
        setWhisperInput('');

        if (node.monologue) { setMonoText(node.monologue); return; }
        setIsMonoGen(true);
        setMonoText('');
        try {
            const text = node.era === 'before_meeting'
                ? await generateMonologue(char, node, api)
                : await generateAfterMonologue(char, node, userProfile.name, api);
            setMonoText(text);
            const updated = { ...node, monologue: text, monologueGeneratedAt: Date.now() };
            saveTrajectoryNode(updated);
            setActiveNode(updated);
            setNodes(prev => prev.map(n => n.id === node.id ? updated : n));
        } catch (e: any) {
            addToast('独白生成失败', 'error');
            console.error('[Trajectory] monologue gen failed:', e);
        } finally {
            setIsMonoGen(false);
        }
    }, [char, api, userProfile]);

    // ── Whisper ──
    const handleWhisper = useCallback(async () => {
        if (!char || !api || !activeNode || !whisperInput.trim()) return;
        setIsWhisperGen(true);
        try {
            const resp = await generateWhisperResponse(char, activeNode, whisperInput.trim(), api);
            setWhisperResp(resp);
            const record = { userWhisper: whisperInput.trim(), charResponse: resp, timestamp: Date.now() };
            const updated = { ...activeNode, whisperHistory: [...(activeNode.whisperHistory || []), record] };
            saveTrajectoryNode(updated);
            setActiveNode(updated);
            setNodes(prev => prev.map(n => n.id === activeNode.id ? updated : n));
        } catch (e: any) {
            addToast('窃语回应失败', 'error');
        } finally {
            setIsWhisperGen(false);
        }
    }, [char, api, activeNode, whisperInput, addToast]);

    // ── Regenerate Nodes ──
    const handleRegen = useCallback(async () => {
        if (!char || !api) return;
        setShowRegenConfirm(false);
        setIsLoading(true);
        try {
            const fresh = await initTrajectory(char, api);
            setNodes(fresh);
            addToast('已重新生成轨迹节点', 'success');
        } catch (e: any) {
            addToast('重新生成失败', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [char, api, addToast]);

    // ── Add Manual Node ──
    const handleAddNode = useCallback(() => {
        if (!char || !addTitle.trim()) return;
        const node = createManualAfterNode(char.id, addTitle.trim(), addKeywords.trim(), nodes.length);
        setNodes(prev => [...prev, node]);
        setShowAddModal(false);
        setAddTitle('');
        setAddKeywords('');
        addToast('已添加节点', 'success');
    }, [char, addTitle, addKeywords, nodes, addToast]);

    // ── TTS (only for after_meeting nodes) ──
    const stopTts = useCallback(() => {
        abortRef.current?.abort();
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
        setIsTtsPlaying(false);
    }, []);

    const handleTts = useCallback(async () => {
        if (!char || !monoText) return;
        if (isTtsPlaying) { stopTts(); return; }
        const baseCfg = getTtsConfig();
        if (!baseCfg.apiKey) { addToast('请先配置 TTS API Key', 'info'); return; }
        const cfg = withCharacterTtsVoice(baseCfg, char);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setIsTtsPlaying(true);
        try {
            const result = await MinimaxTts.synthesizeSync(monoText, cfg, undefined, ctrl.signal);
            audioUrlRef.current = result.url;
            const audio = new Audio(result.url);
            audioRef.current = audio;
            audio.onended = () => setIsTtsPlaying(false);
            audio.onerror = () => setIsTtsPlaying(false);
            await audio.play();
        } catch (e: any) {
            if (e.name !== 'AbortError') addToast('语音合成失败', 'error');
            setIsTtsPlaying(false);
        }
    }, [char, monoText, isTtsPlaying, stopTts, addToast]);

    useEffect(() => () => { stopTts(); }, []);

    // ── Helpers ──
    /** Capitalize first letter for decorative display */
    const moodLabel = (mood: string) => {
        const m = mood as TrajectoryMood;
        return m.charAt(0).toUpperCase() + m.slice(1);
    };

    const getMoodStyle = (mood: string) => {
        const m = MOOD_COLORS[mood as keyof typeof MOOD_COLORS];
        const hue = m?.hue ?? 260;
        return {
            '--node-color': `hsla(${hue}, 65%, 65%, 0.75)`,
            '--node-glow': `hsla(${hue}, 60%, 55%, 0.28)`,
            '--mono-color': `hsla(${hue}, 50%, 55%, 0.3)`,
        } as React.CSSProperties;
    };

    const beforeNodes = nodes.filter(n => n.era === 'before_meeting');
    const afterNodes = nodes.filter(n => n.era === 'after_meeting');

    // ── Per-character trajectory summary (for select page) ──
    const [charNodesMap, setCharNodesMap] = useState<Record<string, TrajectoryNode[]>>({});
    useEffect(() => {
        if (view !== 'select') return;
        const map: Record<string, TrajectoryNode[]> = {};
        for (const c of characters) {
            map[c.id] = getTrajectoryNodes(c.id);
        }
        setCharNodesMap(map);
    }, [view, characters]);

    /** Find the best "continue" candidate — character with the most nodes + unread monologues */
    const getContinueChar = () => {
        let best: CharacterProfile | null = null;
        let bestScore = -1;
        for (const c of characters) {
            const n = charNodesMap[c.id] || [];
            if (n.length === 0) continue;
            const unread = n.filter(nd => !nd.monologue).length;
            const score = n.length * 10 + unread * 5;
            if (score > bestScore) { bestScore = score; best = c; }
        }
        return best;
    };

    const getCharSummary = (c: CharacterProfile) => {
        const n = charNodesMap[c.id] || [];
        if (n.length === 0) return { status: 'empty' as const, nodes: n };
        const before = n.filter(nd => nd.era === 'before_meeting');
        const ages = before.map(nd => nd.age).sort((a, b) => a - b);
        const ageRange = ages.length > 1 ? `${ages[0]}—${ages[ages.length - 1]}岁` : ages.length === 1 ? `${ages[0]}岁` : '';
        const hasAfter = n.some(nd => nd.era === 'after_meeting');
        const phase = hasAfter ? '过去篇 + 相遇后' : '过去篇';
        const unread = n.filter(nd => !nd.monologue).length;
        const keywords = [...new Set(n.flatMap(nd => nd.keywords))].slice(0, 3);
        const lastNode = n[n.length - 1];
        const progress = Math.round(((n.length - unread) / Math.max(n.length, 1)) * 100);
        return { status: 'active' as const, nodes: n, ageRange, phase, unread, keywords, lastNode, progress };
    };

    // ══════════════════════════════════════════
    //  RENDER: Archive Index (Select)
    // ══════════════════════════════════════════
    if (view === 'select') {
        const continueChar = getContinueChar();
        const continueSummary = continueChar ? getCharSummary(continueChar) : null;

        return (
            <div className="trajectory-app traj-archive-page">
                {/* Header */}
                <div className="traj-archive-header">
                    <button className="traj-header-back" onClick={closeApp}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div className="traj-archive-header-text">
                        <div className="traj-archive-title">轨迹档案</div>
                        <div className="traj-archive-subtitle">Archive of Lives</div>
                    </div>
                </div>

                <div className="traj-archive-scroll">
                    {/* Intro */}
                    <div className="traj-archive-intro">记录他们在遇见你之前，已经走过的那些年。</div>

                    {characters.length === 0 ? (
                        /* Empty state */
                        <div className="traj-archive-empty">
                            <div className="traj-archive-empty-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            </div>
                            <div className="traj-archive-empty-title">还没有轨迹档案</div>
                            <div className="traj-archive-empty-desc">为一个角色写入第一段人生节点后，<br/>他的过去会在这里慢慢显影。</div>
                        </div>
                    ) : (
                        <>
                            {/* Continue Card */}
                            {continueChar && continueSummary && continueSummary.status === 'active' && (
                                <div className="traj-continue-card" onClick={() => handleSelectChar(continueChar)}>
                                    <div className="traj-continue-header">
                                        <span className="traj-continue-label">
                                            {continueSummary.progress >= 100 ? '当前档案' : '继续追溯'}
                                        </span>
                                        <span className="traj-continue-status">
                                            {continueSummary.progress >= 100 ? '已完成' : '进行中'}
                                        </span>
                                    </div>
                                    <div className="traj-continue-name">{continueChar.name}</div>
                                    {continueSummary.lastNode && (
                                        <div className="traj-continue-last">
                                            {continueSummary.lastNode.era === 'before_meeting'
                                                ? `${continueSummary.lastNode.age}岁`
                                                : '相遇后'} · {continueSummary.lastNode.title}
                                        </div>
                                    )}
                                    <div className="traj-continue-remaining">
                                        {continueSummary.nodes.length} 个节点 · {continueSummary.ageRange ? `${continueSummary.ageRange}` : continueSummary.phase}
                                        {continueSummary.unread > 0 ? ` · 还有 ${continueSummary.unread} 段未读` : ''}
                                    </div>
                                    <div className="traj-continue-progress-bar">
                                        <div className="traj-continue-progress-fill" style={{ width: `${continueSummary.progress}%` }} />
                                    </div>
                                    <div className="traj-continue-progress-text">{continueSummary.progress}%</div>
                                </div>
                            )}

                            {/* Section title */}
                            <div className="traj-archive-section-title">人物轨迹</div>

                            {/* Character archive cards */}
                            <div className="traj-archive-list">
                                {characters.map(c => {
                                    const summary = getCharSummary(c);
                                    const isActive = summary.status === 'active';
                                    return (
                                        <div key={c.id} className="traj-archive-card" onClick={() => handleSelectChar(c)}>
                                            <img
                                                className="traj-archive-avatar"
                                                src={c.avatar || ''}
                                                alt=""
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                            <div className="traj-archive-card-body">
                                                <div className="traj-archive-card-name">{c.name}</div>
                                                {isActive ? (
                                                    <>
                                                        <div className="traj-archive-card-meta">
                                                            已追溯 {summary.ageRange} · {summary.nodes.length} 个节点 · {summary.phase}
                                                        </div>
                                                        {summary.keywords.length > 0 && (
                                                            <div className="traj-archive-card-tags">
                                                                {summary.keywords.map((k, i) => (
                                                                    <span key={i} className="traj-archive-tag">{k}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="traj-archive-card-meta traj-archive-card-meta--empty">
                                                        记忆档案为空 · 等待写入关键节点
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`traj-archive-card-action ${isActive ? '' : 'traj-archive-card-action--empty'}`}>
                                                {isActive ? '继续' : '新建'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Node type inference for visual differentiation (display only) ──
    const traumaKeywords = ['放逐', '破碎', '消失', '无情', '背叛', '崩塌', '葬礼', '死', '伤', '痛', '血', '冷暴力', '打', '骂'];
    const turningKeywords = ['转折', '离开', '搬家', '婚姻', '分离', '决裂', '逃', '抉择', '觉醒', '独立'];
    const gentleKeywords = ['爷爷', '奶奶', '书法', '庭院', '花', '温暖', '拥抱', '笑', '阳光', '歌', '猫', '雨'];
    const relatedKeywords = ['相遇', '你', '遇见', '关系', '在一起', '告白'];

    const inferNodeType = (node: TrajectoryNode): 'trauma' | 'turning' | 'gentle' | 'related' | 'normal' => {
        const text = `${node.title} ${node.keywords.join(' ')}`;
        if (node.era === 'after_meeting') return 'related';
        if (relatedKeywords.some(k => text.includes(k))) return 'related';
        if (traumaKeywords.some(k => text.includes(k))) return 'trauma';
        if (turningKeywords.some(k => text.includes(k))) return 'turning';
        if (gentleKeywords.some(k => text.includes(k))) return 'gentle';
        return 'normal';
    };

    const nodeTypeLabel: Record<string, string> = {
        trauma: '创伤记忆', turning: '关键转折', gentle: '温柔记忆', related: '与你有关', normal: '普通记忆'
    };

    const nodeMoodTone: Record<string, string> = {
        nostalgic: '微冷', melancholy: '压抑', hopeful: '温暖', rebellious: '灼热',
        peaceful: '平静', painful: '破裂', joyful: '明亮', anxious: '不安', lonely: '空旷'
    };

    const getNodeAccentColor = (type: string) => {
        switch (type) {
            case 'turning': return '#B8A27A';
            case 'trauma': return '#8A5D5D';
            case 'gentle': return '#8FA99A';
            case 'related': return '#C8D6E2';
            default: return '#5F7D96';
        }
    };

    // ── Timeline summary stats ──
    const tlAges = beforeNodes.map(n => n.age).sort((a, b) => a - b);
    const tlAgeRange = tlAges.length > 1 ? `${tlAges[0]}—${tlAges[tlAges.length - 1]}岁` : tlAges.length === 1 ? `${tlAges[0]}岁` : '';
    const tlUnread = nodes.filter(n => !n.monologue).length;
    const tlPhase = afterNodes.length > 0 ? '收录：过去篇 / 相遇后' : '收录：过去篇';

    // ══════════════════════════════════════════
    //  RENDER: Timeline
    // ══════════════════════════════════════════
    if (view === 'timeline') {
        return (
            <div className="trajectory-app traj-detail-page">
                {/* Header */}
                <div className="traj-archive-header">
                    <button className="traj-header-back" onClick={() => { setView('select'); setChar(null); setNodes([]); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div className="traj-archive-header-text">
                        <div className="traj-archive-title">{char?.name}</div>
                        <div className="traj-archive-subtitle">Trajectory Archive</div>
                    </div>
                </div>

                <div className="traj-detail-scroll">
                    {isLoading ? (
                        <div className="traj-detail-loading"><div className="traj-loading-spinner" /><span>正在读取记忆档案…</span></div>
                    ) : nodes.length === 0 ? (
                        /* Empty state */
                        <div className="traj-archive-empty">
                            <div className="traj-archive-empty-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div className="traj-archive-empty-title">还没有可读取的记忆节点</div>
                            <div className="traj-archive-empty-desc">写入第一段人生节点后，这份档案会开始显影。</div>
                        </div>
                    ) : (
                        <>
                            {/* Profile card */}
                            <div className="traj-profile-card">
                                <div className="traj-profile-name">{char?.name}</div>
                                <div className="traj-profile-desc">在遇见你之前，已经独自走过很多年。</div>
                                <div className="traj-profile-stats">
                                    已追溯 {tlAgeRange} · {nodes.length} 个节点 · {tlPhase}
                                </div>
                                <div className="traj-profile-stats" style={{ marginBottom: '12px', color: '#586272' }}>
                                    档案完整度 {nodes.length > 0 ? Math.round(((nodes.length - tlUnread) / nodes.length) * 100) : 0}% · {tlUnread > 0 ? `${tlUnread} 段待读取` : '全部已读'}
                                </div>
                                <button className="traj-profile-action" onClick={() => setShowRegenConfirm(true)}>
                                    {tlUnread > 0 ? '继续追溯' : '重新追溯'}
                                </button>
                            </div>

                            {/* Before Meeting chapter */}
                            {beforeNodes.length > 0 && (
                                <>
                                    <div className="traj-chapter-intro">
                                        <div className="traj-chapter-title">在遇见你之前</div>
                                        <div className="traj-chapter-subtitle">Before You</div>
                                        <div className="traj-chapter-desc">那些尚未与你有关，却已经塑造了{char?.name}的时刻。</div>
                                    </div>

                                    <div className="traj-spine">
                                        {beforeNodes.map((node, idx) => {
                                            const ntype = inferNodeType(node);
                                            const accent = getNodeAccentColor(ntype);
                                            const isRead = !!node.monologue;
                                            return (
                                                <div key={node.id} className={`traj-spine-node traj-spine-node--${ntype} ${isRead ? 'traj-spine-node--read' : ''}`}
                                                     style={{ '--spine-accent': accent, animationDelay: `${idx * 0.07}s` } as React.CSSProperties}
                                                     onClick={() => handleOpenNode(node)}>
                                                    <div className="traj-spine-dot" />
                                                    <div className="traj-spine-card">
                                                        <div className="traj-spine-card-top">
                                                            <span className="traj-spine-age">AGE {String(node.age).padStart(2, '0')}</span>
                                                            <span className="traj-spine-type" style={{ color: accent }}>{nodeTypeLabel[ntype]}</span>
                                                        </div>
                                                        <div className="traj-spine-title">{node.title}</div>
                                                        <div className="traj-spine-excerpt">
                                                            {node.monologue
                                                                ? node.monologue.slice(0, 40).replace(/\n/g, ' ') + '…'
                                                                : '这段记忆仍在整理中。'}
                                                        </div>
                                                        <div className="traj-spine-tags">
                                                            {node.keywords.map((k, i) => <span key={i} className="traj-spine-tag">{k}</span>)}
                                                        </div>
                                                        <div className="traj-spine-footer">
                                                            {node.whisperHistory && node.whisperHistory.length > 0 && (
                                                                <span>残响 {node.whisperHistory.length}</span>
                                                            )}
                                                            <span>情绪底色：{nodeMoodTone[node.mood] || '微冷'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* After Meeting chapter */}
                            {afterNodes.length > 0 && (
                                <>
                                    <div className="traj-chapter-intro">
                                        <div className="traj-chapter-title">在遇见你之后</div>
                                        <div className="traj-chapter-subtitle">After You</div>
                                        <div className="traj-chapter-desc">从此以后，记忆里多了你的痕迹。</div>
                                    </div>

                                    <div className="traj-spine">
                                        {afterNodes.map((node, idx) => {
                                            const isRead = !!node.monologue;
                                            return (
                                                <div key={node.id} className={`traj-spine-node traj-spine-node--related ${isRead ? 'traj-spine-node--read' : ''}`}
                                                     style={{ '--spine-accent': '#C8D6E2', animationDelay: `${idx * 0.07}s` } as React.CSSProperties}
                                                     onClick={() => handleOpenNode(node)}>
                                                    <div className="traj-spine-dot" />
                                                    <div className="traj-spine-card">
                                                        <div className="traj-spine-card-top">
                                                            <span className="traj-spine-age">相遇后</span>
                                                            <span className="traj-spine-type" style={{ color: '#C8D6E2' }}>与你有关</span>
                                                        </div>
                                                        <div className="traj-spine-title">{node.title}</div>
                                                        <div className="traj-spine-tags">
                                                            {node.keywords.map((k, i) => <span key={i} className="traj-spine-tag">{k}</span>)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* Add node button */}
                            <button className="traj-detail-add-btn" onClick={() => setShowAddModal(true)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                                留下一段记忆
                            </button>
                        </>
                    )}
                </div>

                {/* Regen confirm */}
                {showRegenConfirm && (
                    <div className="traj-regen-toast">
                        <span>将重新追溯时光，现有记忆会被覆盖</span>
                        <button className="traj-regen-toast-btn traj-regen-toast-btn--cancel" onClick={() => setShowRegenConfirm(false)}>取消</button>
                        <button className="traj-regen-toast-btn traj-regen-toast-btn--confirm" onClick={handleRegen}>确定</button>
                    </div>
                )}
                {/* Add modal */}
                {showAddModal && (
                    <div className="traj-modal-overlay" onClick={() => setShowAddModal(false)}>
                        <div className="traj-modal" onClick={e => e.stopPropagation()}>
                            <div className="traj-modal-title">留下一段记忆</div>
                            <div className="traj-modal-field">
                                <div className="traj-modal-label">标题</div>
                                <input className="traj-modal-input" placeholder="那段时间的关键记忆" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
                            </div>
                            <div className="traj-modal-field">
                                <div className="traj-modal-label">关键词（逗号分隔）</div>
                                <input className="traj-modal-input" placeholder="第一次见面, 咖啡馆" value={addKeywords} onChange={e => setAddKeywords(e.target.value)} />
                            </div>
                            <div className="traj-modal-actions">
                                <button className="traj-modal-btn" onClick={() => setShowAddModal(false)}>取消</button>
                                <button className="traj-modal-btn traj-modal-btn--primary" onClick={handleAddNode}>添加</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ══════════════════════════════════════════
    //  RENDER: Monologue
    // ══════════════════════════════════════════
    const paragraphs = monoText.split(/\n+/).filter(Boolean);
    const verseText = activeNode?.moodVerse || '';

    return (
        <div className="trajectory-app">
            <div className="traj-monologue" style={activeNode ? getMoodStyle(activeNode.mood) : undefined}>
                <div className="traj-mono-bg" />
                {activeNode && <div className="traj-mono-watermark">{moodLabel(activeNode.mood)}</div>}
                <div className="traj-header" style={{ background: 'transparent', borderBottom: 'none' }}>
                    <button className="traj-header-back" onClick={() => { stopTts(); setView('timeline'); setActiveNode(null); setMonoText(''); setShowWhisper(false); setWhisperResp(''); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                </div>
                <div className="traj-mono-scroll">
                    <div className="traj-mono-header">
                        <div className="traj-mono-age">
                            {activeNode?.era === 'before_meeting' ? `${activeNode?.age}岁` : '在遇见你之后'}
                            <span className="traj-mono-age-en">
                                {activeNode?.era === 'before_meeting' ? `age ${activeNode?.age}` : 'After You'}
                            </span>
                        </div>
                        <div className="traj-mono-title">{activeNode?.title}</div>
                        {verseText && <div className="traj-mono-mood">{verseText}</div>}
                    </div>
                    {isMonoGen ? (
                        <div className="traj-mono-generating"><div className="traj-loading-spinner" style={{ margin: '0 auto 12px' }} /><span>Writing monologue...</span></div>
                    ) : (
                        <div className="traj-mono-text">
                            {paragraphs.map((p, i) => (
                                <div key={i} className="traj-mono-paragraph" style={{ animationDelay: `${i * 0.15}s` }}>{p}</div>
                            ))}
                        </div>
                    )}
                    {!isMonoGen && monoText && showWhisper && (
                        <div className="traj-whisper-zone">
                            {!whisperResp ? (
                                <>
                                    <div className="traj-whisper-prompt">要对那时的{char?.name}说些什么吗</div>
                                    <div className="traj-whisper-input-row">
                                        <input className="traj-whisper-input" placeholder="leave a whisper..." value={whisperInput}
                                            onChange={e => setWhisperInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleWhisper()} disabled={isWhisperGen} />
                                        <button className="traj-whisper-send" onClick={handleWhisper} disabled={isWhisperGen}>
                                            {isWhisperGen
                                                ? <div className="traj-loading-spinner" style={{ width: 16, height: 16 }} />
                                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="traj-whisper-response">{whisperResp}</div>
                                    <div className="traj-whisper-close" onClick={() => { setShowWhisper(false); setWhisperResp(''); setWhisperInput(''); }}>quietly leave</div>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {!isMonoGen && monoText && !showWhisper && (
                    <div className="traj-mono-bar">
                        {activeNode?.era === 'after_meeting' && (
                            <button className={`traj-mono-btn ${isTtsPlaying ? 'traj-mono-btn--playing' : ''}`} onClick={handleTts}>
                                {isTtsPlaying ? (
                                    <><span className="traj-tts-wave"><span className="traj-tts-wave-bar"/><span className="traj-tts-wave-bar"/><span className="traj-tts-wave-bar"/><span className="traj-tts-wave-bar"/></span>listening...</>
                                ) : (
                                    <>hear them</>
                                )}
                            </button>
                        )}
                        <button className="traj-mono-btn traj-mono-btn--primary" onClick={() => setShowWhisper(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            whisper
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrajectoryApp;
