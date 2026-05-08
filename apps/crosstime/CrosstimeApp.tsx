/**
 * CrosstimeApp — 跨时空对话
 * 视图: setup → room → history(只读)
 */
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useOS } from '../../context/OSContext';
import type { CharacterProfile } from '../../types';
import type { TrajectoryNode } from '../../types/trajectory';
import type { CrosstimeParticipant, CrosstimeRoom, CrosstimeMessage } from '../../types/crosstime';
import { getTrajectoryNodes } from '../../utils/db/trajectoryStore';
import {
    getCrosstimeRooms, saveCrosstimeRoom, deleteCrosstimeRoom,
    getCrosstimeMessages, saveCrosstimeMessage,
} from '../../utils/db/crosstimeStore';
import {
    buildParticipantContext, buildCrosstimeDirectorPrompt,
    formatCrosstimeMessages, findSameCharCollisions,
    checkNeedsSummary, buildCrosstimeSummaryPrompt,
    CROSSTIME_SUMMARY_PARTICIPANT_ID, parseSummaryContent,
} from '../../utils/crosstimePrompts';
import { safeResponseJson } from '../../utils/safeApi';
import { getSecondaryApiConfig } from '../../utils/runtimeConfig';
import { extractThinking } from '../../utils/thinkingExtractor';
import './crosstime.css';

type View = 'setup' | 'room' | 'history';
type ModalStep = 'none' | 'pick_char' | 'pick_slice';

const MAX_PARTICIPANTS = 5;

const CrosstimeApp: React.FC = () => {
    const { closeApp, characters, apiConfig, addToast, userProfile } = useOS();

    // ── View ──
    const [view, setView] = useState<View>('setup');

    // ── Setup State ──
    const [participants, setParticipants] = useState<CrosstimeParticipant[]>([]);
    const [modalStep, setModalStep] = useState<ModalStep>('none');
    const [pickedChar, setPickedChar] = useState<CharacterProfile | null>(null);
    const [pickedCharNodes, setPickedCharNodes] = useState<TrajectoryNode[]>([]);

    // ── Room State ──
    const [room, setRoom] = useState<CrosstimeRoom | null>(null);
    const [messages, setMessages] = useState<CrosstimeMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [privateTarget, setPrivateTarget] = useState<CrosstimeParticipant | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── History State ──
    const [historyRooms, setHistoryRooms] = useState<CrosstimeRoom[]>([]);
    const [viewingRoom, setViewingRoom] = useState<CrosstimeRoom | null>(null);
    const [viewingMessages, setViewingMessages] = useState<CrosstimeMessage[]>([]);

    // Load history on setup view
    useEffect(() => {
        if (view === 'setup') setHistoryRooms(getCrosstimeRooms());
    }, [view]);

    // Auto scroll
    useLayoutEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages.length, isTyping]);

    // ── Helpers ──
    const getCharForParticipant = (p: CrosstimeParticipant) => characters.find(c => c.id === p.charId);
    const getNodeForParticipant = (p: CrosstimeParticipant): TrajectoryNode | undefined => {
        if (p.timeSlice !== 'trajectory' || !p.trajectoryNodeId) return undefined;
        return getTrajectoryNodes(p.charId).find(n => n.id === p.trajectoryNodeId);
    };

    // ── Setup: Add Participant ──
    const handlePickChar = (c: CharacterProfile) => {
        setPickedChar(c);
        const nodes = getTrajectoryNodes(c.id);
        setPickedCharNodes(nodes);
        setModalStep('pick_slice');
    };

    const handlePickSlice = (slice: 'current' | TrajectoryNode) => {
        if (!pickedChar) return;
        const p: CrosstimeParticipant = slice === 'current'
            ? {
                id: crypto.randomUUID(),
                charId: pickedChar.id,
                timeSlice: 'current',
                label: '现在',
            }
            : {
                id: crypto.randomUUID(),
                charId: pickedChar.id,
                timeSlice: 'trajectory',
                trajectoryNodeId: slice.id,
                age: slice.age,
                label: slice.era === 'after_meeting' ? '相遇后' : `${slice.age}岁`,
                era: slice.era,
            };
        setParticipants(prev => [...prev, p]);
        setModalStep('none');
        setPickedChar(null);
    };

    const removeParticipant = (id: string) => {
        setParticipants(prev => prev.filter(p => p.id !== id));
    };

    // ── Start Room ──
    const handleStartRoom = () => {
        if (participants.length < 2) { addToast('至少需要 2 个参与者', 'error'); return; }
        if (!apiConfig?.apiKey) { addToast('请先配置 API', 'error'); return; }

        // Auto-generate room name
        const names = [...new Set(participants.map(p => {
            const c = characters.find(ch => ch.id === p.charId);
            return c ? `${c.name}·${p.label}` : p.label;
        }))];
        const roomName = names.join(' × ');

        const newRoom: CrosstimeRoom = {
            id: crypto.randomUUID(),
            name: roomName,
            participants: [...participants],
            userMode: 'online',
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
        };
        setRoom(newRoom);
        setMessages([]);
        setView('room');
        saveCrosstimeRoom(newRoom);
    };

    // ── Toggle Mode ──
    const toggleMode = () => {
        if (!room) return;
        const newMode = room.userMode === 'online' ? 'invisible' : 'online';
        const updated = { ...room, userMode: newMode as 'online' | 'invisible' };
        setRoom(updated);
        saveCrosstimeRoom(updated);
        setPrivateTarget(null);
    };

    // ── Send Message ──
    const handleSend = async () => {
        if (!room || !input.trim() || isTyping) return;
        const text = input.trim();
        setInput('');

        saveCrosstimeMessage({
            roomId: room.id,
            participantId: 'user',
            charId: 'user',
            role: 'user',
            content: text,
            isPrivate: !!privateTarget,
            privateTargetId: privateTarget?.id,
            timestamp: Date.now(),
        });

        setMessages(getCrosstimeMessages(room.id));
        setPrivateTarget(null);
        await triggerDirector(room);
    };

    // ── Director ──
    const triggerDirector = useCallback(async (currentRoom: CrosstimeRoom) => {
        if (!apiConfig?.apiKey) return;
        setIsTyping(true);

        try {
            const allMsgs = getCrosstimeMessages(currentRoom.id);

            // Read per-participant summaries from latest summary message
            const latestSummaryMsg = allMsgs.filter(m => m.participantId === CROSSTIME_SUMMARY_PARTICIPANT_ID).pop();
            const summaryMap = latestSummaryMsg ? parseSummaryContent(latestSummaryMsg.content) : {};

            // Build participant contexts with per-participant memory
            let participantContexts = '';
            const participantList: { pid: string; displayName: string; charId: string }[] = [];

            for (const p of currentRoom.participants) {
                const char = characters.find(c => c.id === p.charId);
                if (!char) continue;
                const node = getNodeForParticipant(p);
                const memory = summaryMap[p.id]; // this participant's own memory
                participantContexts += buildParticipantContext(p, char, userProfile, node, memory);
                participantList.push({
                    pid: p.id,
                    displayName: `${char.name}·${p.label}`,
                    charId: p.charId,
                });
            }

            const recentMsgsStr = formatCrosstimeMessages(allMsgs, currentRoom.participants, characters, userProfile);
            const collisions = findSameCharCollisions(currentRoom.participants);

            const prompt = buildCrosstimeDirectorPrompt(
                participantContexts, participantList, recentMsgsStr,
                userProfile, currentRoom.userMode, collisions, characters,
            );

            const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.9,
                    max_tokens: 4000,
                }),
            });

            if (!response.ok) throw new Error('Director Failed');
            const data = await safeResponseJson(response);
            let jsonStr = data.choices[0].message.content;

            // Parse JSON
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const fb = jsonStr.indexOf('[');
            const lb = jsonStr.lastIndexOf(']');
            if (fb !== -1 && lb !== -1) jsonStr = jsonStr.substring(fb, lb + 1);

            let actions: { participantId: string; content: string }[] = [];
            try {
                actions = JSON.parse(jsonStr);
                if (!Array.isArray(actions)) actions = [];
            } catch { console.error('[Crosstime] Parse error', jsonStr); }

            // Execute actions
            for (const action of actions) {
                const targetP = currentRoom.participants.find(p => p.id === action.participantId);
                if (!targetP) continue;

                // Handle [[PRIVATE: ...]]
                const privateRegex = /\[\[PRIVATE\s*[:：]\s*([\s\S]*?)\]\]/g;
                let match;
                while ((match = privateRegex.exec(action.content)) !== null) {
                    const privateContent = match[1].trim();
                    if (privateContent) {
                        saveCrosstimeMessage({
                            roomId: currentRoom.id,
                            participantId: targetP.id,
                            charId: targetP.charId,
                            role: 'assistant',
                            content: privateContent,
                            isPrivate: true,
                            privateTargetId: 'user',
                            timestamp: Date.now(),
                        });
                    }
                }

                // Public content (strip private blocks)
                const publicContent = action.content.replace(/\[\[PRIVATE\s*[:：]\s*[\s\S]*?\]\]/g, '').trim();
                if (!publicContent) continue;

                // Split by newlines for bubble splitting
                const lines = publicContent.split('\n').map((l: string) => l.trim()).filter(Boolean);
                for (const line of lines) {
                    saveCrosstimeMessage({
                        roomId: currentRoom.id,
                        participantId: targetP.id,
                        charId: targetP.charId,
                        role: 'assistant',
                        content: line,
                        timestamp: Date.now(),
                    });
                    await new Promise(r => setTimeout(r, 50)); // Slight delay for timestamp ordering
                }
            }

            setMessages(getCrosstimeMessages(currentRoom.id));

            // Update room
            const updatedRoom = { ...currentRoom, lastActiveAt: Date.now() };
            setRoom(updatedRoom);
            saveCrosstimeRoom(updatedRoom);

            // Trigger auto-summary in background
            void maybeTriggerSummary(updatedRoom);
        } catch (e: any) {
            console.error('[Crosstime] Director error:', e);
            addToast('对话生成失败: ' + (e.message || ''), 'error');
        } finally {
            setIsTyping(false);
        }
    }, [apiConfig, characters, userProfile, addToast]);

    // ── Auto Summary ──
    const summaryRunningRef = useRef(false);
    const maybeTriggerSummary = useCallback(async (currentRoom: CrosstimeRoom) => {
        if (summaryRunningRef.current) return;
        const allMsgs = getCrosstimeMessages(currentRoom.id);
        const check = checkNeedsSummary(allMsgs);
        if (!check) return;

        const secondaryConfig = getSecondaryApiConfig();
        const summaryApi = (secondaryConfig?.baseUrl && secondaryConfig?.apiKey)
            ? secondaryConfig
            : apiConfig;
        if (!summaryApi?.baseUrl || !summaryApi?.apiKey) return;

        summaryRunningRef.current = true;
        try {
            const prompt = buildCrosstimeSummaryPrompt(
                check.messagesToSummarize,
                currentRoom.participants, characters, userProfile,
                check.existingSummaries,
            );

            const response = await fetch(`${summaryApi.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${summaryApi.apiKey}` },
                body: JSON.stringify({
                    model: summaryApi.model || apiConfig?.model,
                    messages: [
                        { role: 'system', content: '你负责为跨时空对话中的每个参与者分别整理回忆。严格输出 JSON。' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.4,
                }),
            });

            if (!response.ok) throw new Error('Summary API failed');
            const data = await safeResponseJson(response);
            const raw = data.choices?.[0]?.message?.content || '';
            const extracted = extractThinking(raw);
            let jsonStr = extracted.content.trim();

            // Parse JSON from response
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const fb = jsonStr.indexOf('{');
            const lb = jsonStr.lastIndexOf('}');
            if (fb !== -1 && lb !== -1) jsonStr = jsonStr.substring(fb, lb + 1);

            // Validate it's a proper per-participant map
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Summary output is not a valid JSON object');
            }

            saveCrosstimeMessage({
                roomId: currentRoom.id,
                participantId: CROSSTIME_SUMMARY_PARTICIPANT_ID,
                charId: '__system__',
                role: 'system',
                content: JSON.stringify(parsed),
                timestamp: Date.now(),
            });
            console.log('[Crosstime] Per-participant summary saved:', Object.keys(parsed));
        } catch (e) {
            console.warn('[Crosstime] Auto-summary failed:', e);
        } finally {
            summaryRunningRef.current = false;
        }
    }, [apiConfig, characters, userProfile]);

    // ── Exit Room ──
    const handleExitRoom = () => {
        setView('setup');
        setRoom(null);
        setMessages([]);
        setParticipants([]);
        setPrivateTarget(null);
    };

    // ── View History ──
    const handleViewHistory = (r: CrosstimeRoom) => {
        setViewingRoom(r);
        setViewingMessages(getCrosstimeMessages(r.id));
        setView('history');
    };

    const handleDeleteHistory = (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        deleteCrosstimeRoom(roomId);
        setHistoryRooms(prev => prev.filter(r => r.id !== roomId));
        addToast('记录已删除', 'info');
    };

    // ═══════════════════════════════
    //  RENDER: History (readonly)
    // ═══════════════════════════════
    if (view === 'history' && viewingRoom) {
        return (
            <div className="crosstime-app">
                <div className="crosstime-header">
                    <button className="crosstime-header-back" onClick={() => { setView('setup'); setViewingRoom(null); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div className="crosstime-header-text">
                        <div className="crosstime-header-title">{viewingRoom.name}</div>
                        <div className="crosstime-header-subtitle">{new Date(viewingRoom.createdAt).toLocaleDateString()} · 只读</div>
                    </div>
                </div>
                <div className="crosstime-chat-scroll">
                    {viewingMessages.map(m => {
                        if (m.participantId === CROSSTIME_SUMMARY_PARTICIPANT_ID) return null;
                        const p = viewingRoom.participants.find(pp => pp.id === m.participantId);
                        const char = p ? characters.find(c => c.id === p.charId) : null;
                        const isUser = m.role === 'user';
                        return (
                            <div key={m.id} className={`crosstime-msg ${isUser ? 'crosstime-msg--user' : ''} ${m.isPrivate ? 'crosstime-msg--private' : ''}`}>
                                <img className={`crosstime-msg-avatar ${p?.timeSlice === 'trajectory' ? 'crosstime-msg-avatar--past' : ''}`}
                                     src={isUser ? userProfile.avatar : (char?.avatar || '')} alt="" />
                                <div className="crosstime-msg-body">
                                    <div className="crosstime-msg-name">{isUser ? userProfile.name : `${char?.name || '?'}·${p?.label || '?'}`}</div>
                                    <div className="crosstime-msg-bubble">{m.content}</div>
                                </div>
                            </div>
                        );
                    })}
                    {viewingMessages.length === 0 && (
                        <div className="crosstime-empty">
                            <div className="crosstime-empty-title">没有对话记录</div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════
    //  RENDER: Room
    // ═══════════════════════════════
    if (view === 'room' && room) {
        const isInvisible = room.userMode === 'invisible';
        return (
            <div className="crosstime-app">
                {/* Header */}
                <div className="crosstime-header">
                    <button className="crosstime-header-back" onClick={handleExitRoom}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div className="crosstime-header-text">
                        <div className="crosstime-header-title">跨时空对话</div>
                        <div className="crosstime-header-subtitle">Crosstime Chat</div>
                    </div>
                    <button className={`crosstime-header-mode-btn ${isInvisible ? 'crosstime-header-mode-btn--invisible' : ''}`} onClick={toggleMode}>
                        {isInvisible ? '👁 隐身中' : '💬 在线'}
                    </button>
                </div>

                {/* Participant bar */}
                <div className="crosstime-participants">
                    {room.participants.map(p => {
                        const char = getCharForParticipant(p);
                        return (
                            <div key={p.id}
                                 className={`crosstime-participant-chip ${privateTarget?.id === p.id ? 'crosstime-participant-chip--active' : ''}`}
                                 onClick={() => {
                                     if (!isInvisible) setPrivateTarget(prev => prev?.id === p.id ? null : p);
                                 }}>
                                <img className={`crosstime-participant-avatar ${p.timeSlice === 'trajectory' ? 'crosstime-participant-avatar--past' : ''}`}
                                     src={char?.avatar || ''} alt="" />
                                <span className="crosstime-participant-label">{char?.name}<br/>{p.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Invisible banner */}
                {isInvisible && (
                    <div className="crosstime-invisible-banner">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        你正在隐身旁观…
                    </div>
                )}

                {/* Chat */}
                <div className="crosstime-chat-scroll" ref={scrollRef}>
                    {messages.map(m => {
                        // Skip internal summary messages
                        if (m.participantId === CROSSTIME_SUMMARY_PARTICIPANT_ID) return null;
                        const p = room.participants.find(pp => pp.id === m.participantId);
                        const char = p ? characters.find(c => c.id === p.charId) : null;
                        const isUser = m.role === 'user';
                        return (
                            <div key={m.id} className={`crosstime-msg ${isUser ? 'crosstime-msg--user' : ''} ${m.isPrivate ? 'crosstime-msg--private' : ''}`}>
                                <img className={`crosstime-msg-avatar ${p?.timeSlice === 'trajectory' ? 'crosstime-msg-avatar--past' : ''}`}
                                     src={isUser ? userProfile.avatar : (char?.avatar || '')} alt="" />
                                <div className="crosstime-msg-body">
                                    <div className="crosstime-msg-name">{isUser ? userProfile.name : `${char?.name || '?'}·${p?.label || '?'}`}</div>
                                    <div className="crosstime-msg-bubble">{m.content}</div>
                                </div>
                            </div>
                        );
                    })}
                    {isTyping && (
                        <div className="crosstime-typing">
                            <div className="crosstime-typing-dots"><span/><span/><span/></div>
                            对话生成中…
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                {isInvisible ? (
                    <div className="crosstime-invisible-bar">
                        <button className="crosstime-invisible-btn" onClick={() => triggerDirector(room)} disabled={isTyping}>
                            📡 推进对话
                        </button>
                        <button className="crosstime-invisible-btn crosstime-invisible-btn--appear" onClick={toggleMode}>
                            👁 现身
                        </button>
                    </div>
                ) : (
                    <div className="crosstime-bottom-bar">
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {privateTarget && (
                                <div className="crosstime-private-hint">
                                    悄悄对 {characters.find(c => c.id === privateTarget.charId)?.name}·{privateTarget.label} 说…
                                    <span onClick={() => setPrivateTarget(null)} style={{ cursor: 'pointer', marginLeft: 6 }}>✕</span>
                                </div>
                            )}
                            <input className="crosstime-input"
                                   placeholder={privateTarget ? '输入悄悄话…' : '说点什么…'}
                                   value={input} onChange={e => setInput(e.target.value)}
                                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                   disabled={isTyping} />
                        </div>
                        <button className="crosstime-send-btn" onClick={handleSend} disabled={isTyping || !input.trim()}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                        <button className="crosstime-director-btn" onClick={() => triggerDirector(room)} disabled={isTyping} title="触发导演">
                            ⚡
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════
    //  RENDER: Setup
    // ═══════════════════════════════
    return (
        <div className="crosstime-app">
            <div className="crosstime-header">
                <button className="crosstime-header-back" onClick={closeApp}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div className="crosstime-header-text">
                    <div className="crosstime-header-title">跨时空对话</div>
                    <div className="crosstime-header-subtitle">Crosstime Chat</div>
                </div>
            </div>

            <div className="crosstime-setup-scroll">
                <div className="crosstime-setup-intro">让不同时间的他们坐在一起，聊聊天。</div>

                <div className="crosstime-section-title">参与者</div>
                <div className="crosstime-selected-list">
                    {participants.map(p => {
                        const char = getCharForParticipant(p);
                        return (
                            <div key={p.id} className="crosstime-selected-item">
                                <img src={char?.avatar || ''} alt=""
                                     style={p.timeSlice === 'trajectory' ? { filter: 'grayscale(0.3) sepia(0.15)' } : undefined} />
                                <div className="crosstime-selected-item-info">
                                    <div className="crosstime-selected-item-name">{char?.name || '?'}</div>
                                    <div className="crosstime-selected-item-label">{p.label}{p.era === 'before_meeting' ? ' · 相遇前' : ''}</div>
                                </div>
                                <button className="crosstime-selected-item-remove" onClick={() => removeParticipant(p.id)}>×</button>
                            </div>
                        );
                    })}
                </div>

                {participants.length < MAX_PARTICIPANTS && (
                    <button className="crosstime-add-btn" onClick={() => setModalStep('pick_char')}>
                        + 添加参与者
                    </button>
                )}

                <button className="crosstime-start-btn" onClick={handleStartRoom}
                        disabled={participants.length < 2 || !apiConfig?.apiKey}>
                    开始对话
                </button>

                {/* History */}
                {historyRooms.length > 0 && (
                    <div className="crosstime-history-section">
                        <div className="crosstime-section-title">过往记录</div>
                        {historyRooms.map(r => (
                            <div key={r.id} className="crosstime-history-item" onClick={() => handleViewHistory(r)}>
                                <div>
                                    <div className="crosstime-history-name">{r.name}</div>
                                    <div className="crosstime-history-meta">{new Date(r.createdAt).toLocaleDateString()}</div>
                                </div>
                                <button className="crosstime-history-delete" onClick={e => handleDeleteHistory(e, r.id)}>×</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modal: Pick Character ── */}
            {modalStep === 'pick_char' && (
                <div className="crosstime-modal-overlay" onClick={() => setModalStep('none')}>
                    <div className="crosstime-modal" onClick={e => e.stopPropagation()}>
                        <div className="crosstime-modal-title">选择角色</div>
                        <div className="crosstime-char-list">
                            {characters.map(c => (
                                <div key={c.id} className="crosstime-char-option" onClick={() => handlePickChar(c)}>
                                    <img src={c.avatar} alt="" />
                                    <div>
                                        <div className="crosstime-char-option-name">{c.name}</div>
                                        <div className="crosstime-char-option-desc">{c.description || '暂无描述'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Pick Time Slice ── */}
            {modalStep === 'pick_slice' && pickedChar && (
                <div className="crosstime-modal-overlay" onClick={() => setModalStep('none')}>
                    <div className="crosstime-modal" onClick={e => e.stopPropagation()}>
                        <div className="crosstime-modal-title">选择{pickedChar.name}的时间版本</div>
                        <div className="crosstime-timeslice-list">
                            <div className="crosstime-timeslice-option" onClick={() => handlePickSlice('current')}>
                                <div className="crosstime-timeslice-label">现在的{pickedChar.name}</div>
                                <div className="crosstime-timeslice-detail">完整记忆 · 认识你</div>
                            </div>
                            {pickedCharNodes.map(node => (
                                <div key={node.id} className="crosstime-timeslice-option" onClick={() => handlePickSlice(node)}>
                                    <div className="crosstime-timeslice-label">
                                        {node.era === 'after_meeting' ? '相遇后' : `${node.age}岁`} · {node.title}
                                    </div>
                                    <div className="crosstime-timeslice-detail">
                                        {node.keywords.join('、')}{node.era === 'before_meeting' ? ' · 不认识你' : ''}
                                    </div>
                                </div>
                            ))}
                            {pickedCharNodes.length === 0 && (
                                <div className="crosstime-empty">
                                    <div className="crosstime-empty-desc">这个角色还没有轨迹节点，只能选择「现在」版本。</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CrosstimeApp;
