/**
 * TheaterApp — 520 约会剧场 主入口
 * 模式流转: select → map → session
 * 导演引擎 (副API) + 角色扮演 (主API) 双API架构
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOS } from '../../context/OSContext';
import { DB } from '../../utils/db';
import { ContextBuilder } from '../../utils/context';
import { safeResponseJson } from '../../utils/safeApi';
import { extractThinking } from '../../utils/thinkingExtractor';
import { getSecondaryApiConfig } from '../../utils/runtimeConfig';
import { buildDatePreamble, buildTheaterScene, buildDateTail } from '../../utils/datePrompts';
import { DEFAULT_DATE_SUMMARY_PROMPT, buildSummaryPrompt, formatDateMessagesForBridge } from '../../utils/dateSummaryPrompts';
import { renderMarkdown } from '../../utils/markdownLite';
import type { CharacterProfile, Message, TheaterLocation, DirectorEvent, TheaterSessionState } from '../../types';

import {
    computeWeights, rollEventType, shouldTriggerEvent, updatePity,
    createPityCounter, advanceTimeSlot, getInitialTimeSlot,
    is520EventActive, generateSessionId,
} from '../../utils/theaterDirector';
import {
    buildDirectorPrompt, buildTheaterSceneInjection, buildInitialScenePrompt,
    build520ConfessionHint, parseDirectorResponse,
} from '../../utils/theaterPrompts';
import { getPresetLocations } from '../../utils/theaterLocations';
import {
    saveTheaterSession, getTheaterSession, deleteTheaterSession,
    getCustomLocations, addCustomLocation as dbAddCustomLocation,
    deleteCustomLocation as dbDeleteCustomLocation,
    getVisitCounts, incrementVisitCount,
} from '../../utils/db/theaterStore';

import TheaterMap from './TheaterMap';
import TheaterSession from './TheaterSession';
import Modal from '../../components/os/Modal';
import './theater.css';

type Mode = 'select' | 'map' | 'session';
export type TheaterExitSyncMode = 'summary' | 'raw' | 'none';

type SummaryDraft = {
    content: string;
    summaryType: 'auto' | 'manual';
    coveredMsgIds: number[];
    sessionStartMsgId: number;
    promptSnapshot: string;
    lastCoveredMsgId: number;
    bridgeOnSave?: boolean;
    bridgeOnly?: boolean;
    bridgeAlreadySaved?: boolean;
    sourceSummaryMsgId?: number;
    fromPendingAuto?: boolean;
};

const THEATER_SUMMARY_CONTEXT_KEEP_COUNT = 5;

const isTheaterMessage = (m: Message) =>
    m.metadata?.source === 'theater' && !m.metadata?.hiddenFromUser;

const isTheaterRawMessage = (m: Message) =>
    m.metadata?.source === 'theater' && !m.metadata?.isSummary && !m.metadata?.isDateContextBridge;

const isTheaterSummaryMessage = (m: Message) =>
    m.metadata?.source === 'theater' && m.metadata?.isSummary === true;

const hasCompleteApiConfig = (config?: { baseUrl?: string; apiKey?: string; model?: string } | null): config is { baseUrl: string; apiKey: string; model: string } =>
    !!config?.baseUrl?.trim() && !!config?.apiKey?.trim() && !!config?.model?.trim();

const getCurrentTheaterSessionMessages = (msgs: Message[]) => {
    const theatMsgs = msgs.filter(isTheaterRawMessage).sort((a, b) => a.timestamp - b.timestamp);
    const openingIndex = theatMsgs.map(m => m.metadata?.isOpening).lastIndexOf(true);
    return openingIndex >= 0 ? theatMsgs.slice(openingIndex) : theatMsgs;
};

const buildTheaterSummaryMemoryPrompt = (msgs: Message[]) => {
    const sessionMessages = getCurrentTheaterSessionMessages(msgs);
    if (sessionMessages.length === 0) return '';
    const sessionStartMsgId = sessionMessages[0].id;
    const sessionMsgIds = new Set(sessionMessages.map(m => m.id));
    const summaries = msgs
        .filter(isTheaterSummaryMessage)
        .filter(s => s.metadata?.sessionStartMsgId === sessionStartMsgId || (
            Array.isArray(s.metadata?.coveredMsgIds) && s.metadata.coveredMsgIds.some((id: unknown) => typeof id === 'number' && sessionMsgIds.has(id))
        ))
        .sort((a, b) => a.timestamp - b.timestamp);
    if (summaries.length === 0) return '';
    const blocks = summaries.map((s, i) => {
        const label = s.metadata?.summaryType === 'auto' ? '自动总结' : '手动总结';
        return `### 已总结片段 ${i + 1}（${label}）\n${s.content}`;
    }).join('\n\n');
    return `\n\n### 【本次剧场的已总结上下文】\n以下是本次剧场中较早内容的压缩总结。它们是刚才520约会已经发生过的事，不是新消息。请把这些当作共同经历的背景，和后续未总结原文自然衔接。\n\n${blocks}\n`;
};

const TheaterApp: React.FC = () => {
    const { closeApp, characters, setActiveCharacterId, apiConfig, addToast, userProfile, updateCharacter } = useOS();

    // ── Core State ──
    const [mode, setMode] = useState<Mode>('select');
    const [char, setChar] = useState<CharacterProfile | null>(null);

    // ── Session State ──
    const [session, setSession] = useState<TheaterSessionState | null>(null);
    const [locations, setLocations] = useState<TheaterLocation[]>([]);
    const [currentLocation, setCurrentLocation] = useState<TheaterLocation | null>(null);
    const [theaterMessages, setTheaterMessages] = useState<Message[]>([]);
    const [currentEvent, setCurrentEvent] = useState<DirectorEvent | null>(null);

    // ── Loading State ──
    const [isDirectorLoading, setIsDirectorLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // ── Exit Review ──
    const [showExitReview, setShowExitReview] = useState(false);

    // ── Summary State ──
    const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
    const [activeSummaryDraft, setActiveSummaryDraft] = useState<SummaryDraft | null>(null);
    const [pendingAutoSummary, setPendingAutoSummary] = useState<SummaryDraft | null>(null);
    const [showSummarySettings, setShowSummarySettings] = useState(false);
    const [summaryPromptDraft, setSummaryPromptDraft] = useState('');
    const summaryGeneratingRef = useRef(false);

    const secondaryApiConfig = getSecondaryApiConfig();
    const canManualSummary = hasCompleteApiConfig(secondaryApiConfig) || hasCompleteApiConfig(apiConfig);
    const canAutoSummary = hasCompleteApiConfig(secondaryApiConfig);
    const summaryDisabledReason = canManualSummary ? undefined : '请先配置主 API 或副 API';

    // ── Pity ref for non-stale access in callbacks ──
    const sessionRef = useRef(session);
    useEffect(() => { sessionRef.current = session; }, [session]);

    // ── Keep local char in sync with global characters (e.g. after sprite config save) ──
    useEffect(() => {
        if (!char) return;
        const latest = characters.find(c => c.id === char.id);
        if (latest && latest !== char) setChar(latest);
    }, [characters, char]);

    // ── Init locations ──
    useEffect(() => {
        const presets = getPresetLocations();
        const custom = getCustomLocations();
        const counts = getVisitCounts();
        const merged = [...presets, ...custom].map(loc => ({
            ...loc,
            visitCount: counts[loc.id] || loc.visitCount || 0,
        }));
        setLocations(merged);
    }, []);

    // ── Character Selection ──
    const handleSelectChar = useCallback(async (c: CharacterProfile) => {
        setChar(c);
        setActiveCharacterId(c.id);

        // Check for saved session
        const saved = getTheaterSession(c.id);
        if (saved) {
            setSession(saved);
            const loc = locations.find(l => l.id === saved.currentLocationId);
            if (loc) setCurrentLocation(loc);

            // Load messages
            const allMsgs = await DB.getMessagesByCharId(c.id);
            setTheaterMessages(allMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));
        } else {
            // New session
            const newSession: TheaterSessionState = {
                sessionId: generateSessionId(),
                charId: c.id,
                currentLocationId: '',
                timeSlot: getInitialTimeSlot(),
                locationChangeCount: 0,
                pity: createPityCounter(),
                eventHistory: [],
                visitedLocationIds: [],
                is520Event: is520EventActive(),
                startedAt: Date.now(),
                lastActiveAt: Date.now(),
            };
            setSession(newSession);
        }
        setMode('map');
    }, [locations, setActiveCharacterId]);

    // ── Location Selection ──
    const handleSelectLocation = useCallback(async (loc: TheaterLocation) => {
        if (!char || !session) return;

        const isNewLocation = loc.id !== session.currentLocationId;
        let updatedSession = { ...session, currentLocationId: loc.id, lastActiveAt: Date.now() };

        if (isNewLocation) {
            updatedSession.locationChangeCount += 1;
            if (!updatedSession.visitedLocationIds.includes(loc.id)) {
                updatedSession.visitedLocationIds.push(loc.id);
            }
            // Advance time
            updatedSession.timeSlot = advanceTimeSlot(
                session.timeSlot,
                updatedSession.locationChangeCount,
            );
            // Update visit count on location (persisted)
            const newCount = incrementVisitCount(loc.id);
            loc = { ...loc, visitCount: newCount, lastVisitTime: Date.now() };
            setLocations(prev => prev.map(l => l.id === loc.id ? loc : l));
        }

        setSession(updatedSession);
        setCurrentLocation(loc);
        setCurrentEvent(null);
        saveTheaterSession(updatedSession);
        setMode('session');

        // Generate initial ambient scene
        if (isNewLocation) {
            await generateInitialScene(loc, updatedSession);
        }
    }, [char, session]);

    // ── Generate Initial Scene (entering a new location) ──
    const generateInitialScene = async (loc: TheaterLocation, sess: TheaterSessionState) => {
        if (!char || !apiConfig?.baseUrl) return;

        setIsAiLoading(true);
        try {
            const scenePrompt = buildInitialScenePrompt(loc, sess.timeSlot, char.name, userProfile.name);

            // Build system prompt (reuse date mode prompts)
            let systemPrompt = buildDatePreamble(char.name, userProfile.name);
            systemPrompt += ContextBuilder.buildCoreContext(char, userProfile);
            systemPrompt += `\n\n${scenePrompt}`;

            const REQUIRED_EMOTIONS = ['normal', 'happy', 'angry', 'sad', 'shy'];
            const dateEmotions = [...REQUIRED_EMOTIONS, ...(char.customDateSprites || [])];
            const userPov = char.datePerspective || 'second';
            const charPov = char.dateCharPerspective || 'third';
            systemPrompt += buildTheaterScene(char.name, userProfile.name, dateEmotions, userPov, charPov);

            const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `（你们刚到 ${loc.name}。请写一段到场描写。）` },
                    ],
                    temperature: 0.85,
                }),
            });

            if (!response.ok) throw new Error('API Error');
            const data = await safeResponseJson(response);
            const raw = data.choices[0].message.content;
            const extracted = extractThinking(raw);

            await DB.saveMessage({
                charId: char.id, role: 'assistant', type: 'text',
                content: extracted.content,
                metadata: { source: 'theater', isOpening: true, locationId: loc.id, thinking: extracted.thinking },
            });

            const freshMsgs = await DB.getMessagesByCharId(char.id);
            setTheaterMessages(freshMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));
        } catch (e) {
            console.error('[Theater] Initial scene error:', e);
            addToast('场景加载失败', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    // ── Send Message (with director engine integration) ──
    const handleSendMessage = useCallback(async (text: string) => {
        if (!char || !currentLocation || !session || !apiConfig?.baseUrl) return;

        // 1. Save user message
        await DB.saveMessage({
            charId: char.id, role: 'user', type: 'text', content: text,
            metadata: { source: 'theater', locationId: currentLocation.id },
        });

        // Refresh messages
        let allMsgs = await DB.getMessagesByCharId(char.id);
        setTheaterMessages(allMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));

        // 2. Check pity system — should we trigger a director event?
        const triggered = shouldTriggerEvent(session.pity);
        let directorEvent: DirectorEvent | null = null;

        if (triggered) {
            // 2a. Roll event type
            const weights = computeWeights(currentLocation, session.timeSlot, session.eventHistory, session.is520Event);
            const eventType = rollEventType(weights);

            // 2b. Call director (secondary API)
            const secondaryConfig = getSecondaryApiConfig();
            if (secondaryConfig?.baseUrl && secondaryConfig?.apiKey) {
                setIsDirectorLoading(true);
                try {
                    const directorPrompt = buildDirectorPrompt(
                        char.name, userProfile.name, currentLocation,
                        session.timeSlot, eventType, session.eventHistory,
                    );

                    const dirResponse = await fetch(`${secondaryConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secondaryConfig.apiKey}` },
                        body: JSON.stringify({
                            model: secondaryConfig.model || apiConfig.model,
                            messages: [{ role: 'user', content: directorPrompt }],
                            temperature: 0.7,
                            max_tokens: 400,
                        }),
                    });

                    if (dirResponse.ok) {
                        const dirData = await safeResponseJson(dirResponse);
                        const rawDir = dirData.choices[0].message.content;
                        directorEvent = parseDirectorResponse(rawDir);
                    }
                } catch (e) {
                    console.warn('[Theater] Director call failed, proceeding without event:', e);
                } finally {
                    setIsDirectorLoading(false);
                }
            }
        }

        // 3. Update pity
        const updatedPity = updatePity(session.pity, !!directorEvent);
        const updatedSession = {
            ...session,
            pity: updatedPity,
            eventHistory: directorEvent ? [...session.eventHistory, directorEvent] : session.eventHistory,
            lastActiveAt: Date.now(),
        };
        setSession(updatedSession);
        saveTheaterSession(updatedSession);

        if (directorEvent) {
            setCurrentEvent(directorEvent);
        }

        // 4. Call main API (character roleplay)
        setIsAiLoading(true);
        try {
            let systemPrompt = buildDatePreamble(char.name, userProfile.name);
            systemPrompt += ContextBuilder.buildCoreContext(char, userProfile);
            systemPrompt += buildTheaterSummaryMemoryPrompt(allMsgs);

            // Inject director event if triggered
            if (directorEvent) {
                systemPrompt += buildTheaterSceneInjection(directorEvent, currentLocation, session.timeSlot);
            }

            // 520 confession hint (night + romantic + 520 event)
            if (session.is520Event && session.timeSlot === 'night' && directorEvent?.sceneType === 'romantic') {
                systemPrompt += build520ConfessionHint(char.name);
            }

            const REQUIRED_EMOTIONS = ['normal', 'happy', 'angry', 'sad', 'shy'];
            const dateEmotions = [...REQUIRED_EMOTIONS, ...(char.customDateSprites || [])];
            const userPov = char.datePerspective || 'second';
            const charPov = char.dateCharPerspective || 'third';
            systemPrompt += buildTheaterScene(char.name, userProfile.name, dateEmotions, userPov, charPov);
            systemPrompt += buildDateTail(char.name, userProfile.name, userPov, charPov);

            // Build history
            allMsgs = await DB.getMessagesByCharId(char.id);
            const theaterMsgs = allMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp);
            const limit = char.contextLimit || 500;
            const historyMsgs = theaterMsgs.slice(-limit, -1).map(m => ({
                role: m.role,
                content: m.type === 'image' ? '[User sent an image]' : m.content,
            }));

            const eventNote = directorEvent
                ? `\n\n(System: 导演事件已触发 [${directorEvent.sceneType}]。你必须在回复中自然地对这个事件做出反应。严格遵守沉浸剧场格式。)`
                : `\n\n(System: 严格遵守沉浸剧场格式。每一行都要以 [emotion] 开头。)`;

            const response = await fetch(`${apiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...historyMsgs,
                        { role: 'user', content: text + eventNote },
                    ],
                    temperature: 0.85,
                }),
            });

            if (!response.ok) throw new Error('API Error');
            const data = await safeResponseJson(response);
            const raw = data.choices[0].message.content;
            const extracted = extractThinking(raw);

            await DB.saveMessage({
                charId: char.id, role: 'assistant', type: 'text',
                content: extracted.content,
                metadata: {
                    source: 'theater',
                    locationId: currentLocation.id,
                    directorEvent: directorEvent?.sceneType || null,
                    thinking: extracted.thinking,
                },
            });

            const freshMsgs = await DB.getMessagesByCharId(char.id);
            setTheaterMessages(freshMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));
            void maybeTriggerAutoSummary(freshMsgs);
        } catch (e) {
            console.error('[Theater] AI response error:', e);
            addToast('回复生成失败', 'error');
        } finally {
            setIsAiLoading(false);
        }
    }, [char, currentLocation, session, apiConfig, userProfile, addToast]);

    // ── Add Custom Location ──
    const handleAddLocation = useCallback((loc: TheaterLocation) => {
        dbAddCustomLocation(loc);
        setLocations(prev => [...prev, loc]);
        addToast(`已添加「${loc.name}」`, 'success');
    }, [addToast]);

    // ── Delete Custom Location ──
    const handleDeleteCustomLocation = useCallback((id: string) => {
        dbDeleteCustomLocation(id);
        setLocations(prev => prev.filter(l => l.id !== id));
        addToast('已删除自定义地点', 'info');
    }, [addToast]);

    // ══════════════════════════════════════════════
    //  Summary System (ported from DateApp)
    // ══════════════════════════════════════════════

    const generateSummaryDraft = async (summaryType: 'auto' | 'manual'): Promise<SummaryDraft | null> => {
        if (!char || summaryGeneratingRef.current) return null;
        const secondaryConfig = getSecondaryApiConfig();
        const selectedApi = summaryType === 'auto'
            ? secondaryConfig
            : (hasCompleteApiConfig(secondaryConfig) ? secondaryConfig : apiConfig);
        if (!hasCompleteApiConfig(selectedApi)) {
            if (summaryType === 'manual') addToast('请先配置 API', 'error');
            return null;
        }
        summaryGeneratingRef.current = true;
        setIsSummaryGenerating(true);
        try {
            const allMsgs = await DB.getMessagesByCharId(char.id);
            const sessionMessages = getCurrentTheaterSessionMessages(allMsgs);
            if (sessionMessages.length === 0) { if (summaryType === 'manual') addToast('还没有可总结的剧场内容', 'info'); return null; }
            const targetMessages = summaryType === 'auto'
                ? sessionMessages.filter(m => (!char.theaterSummaryLastAutoMsgId || m.id > char.theaterSummaryLastAutoMsgId) && !m.metadata?.dateSummaryAutoHidden)
                : sessionMessages;
            const threshold = char.theaterSummaryAutoThreshold || 20;
            if (summaryType === 'auto' && targetMessages.length < threshold) return null;
            if (targetMessages.length < 4) { if (summaryType === 'manual') addToast('消息太少，无法总结', 'info'); return null; }
            const promptSnapshot = char.theaterSummaryPrompt?.trim() || DEFAULT_DATE_SUMMARY_PROMPT;
            const prompt = buildSummaryPrompt(char.name, userProfile.name, new Date().toLocaleString(), targetMessages, promptSnapshot);
            const response = await fetch(`${selectedApi.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${selectedApi.apiKey}` },
                body: JSON.stringify({
                    model: selectedApi.model,
                    messages: [
                        { role: 'system', content: '你负责把520约会剧场记录整理成可供角色之后自然记住的总结。只输出总结正文。' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.45,
                }),
            });
            if (!response.ok) throw new Error(`Summary API Error: ${response.status}`);
            const data = await safeResponseJson(response);
            const extracted = extractThinking(data.choices?.[0]?.message?.content || '');
            const content = extracted.content.trim();
            if (!content) throw new Error('Summary content empty');
            const coveredMsgIds = targetMessages.map(m => m.id);
            return {
                content, summaryType, coveredMsgIds,
                sessionStartMsgId: sessionMessages[0].id, promptSnapshot,
                lastCoveredMsgId: coveredMsgIds[coveredMsgIds.length - 1],
            };
        } catch (e: any) {
            if (summaryType === 'manual') addToast(`总结生成失败: ${e.message || e}`, 'error');
            else console.warn('[TheaterSummary] auto summary failed:', e);
            return null;
        } finally {
            summaryGeneratingRef.current = false;
            setIsSummaryGenerating(false);
        }
    };

    const hideCoveredMsgIds = async (coveredMsgIds: number[], summaryMsgId: number) => {
        const idsToHide = coveredMsgIds.slice(0, Math.max(0, coveredMsgIds.length - THEATER_SUMMARY_CONTEXT_KEEP_COUNT));
        if (idsToHide.length === 0) return;
        await Promise.all(idsToHide.map(id => DB.updateMessageMetadata(id, {
            hiddenFromUser: true, dateSummaryAutoHidden: true, hiddenBySummaryMsgId: summaryMsgId,
        })));
    };

    const saveSummaryDraft = async (draft: SummaryDraft) => {
        if (!char) return;
        if (draft.bridgeAlreadySaved) {
            if (char.theaterSummaryAutoHideEnabled && draft.sourceSummaryMsgId) await hideCoveredMsgIds(draft.coveredMsgIds, draft.sourceSummaryMsgId);
            setActiveSummaryDraft(null);
            addToast('已复用已保存总结同步到主聊天', 'success');
            return;
        }
        if (draft.bridgeOnly) {
            const bridgeMsgId = await DB.saveMessage({
                charId: char.id, role: 'system', type: 'text', content: draft.content,
                metadata: { source: 'theater', hiddenFromUser: true, isDateContextBridge: true, bridgeType: 'summary', coveredMsgIds: draft.coveredMsgIds, sessionStartMsgId: draft.sessionStartMsgId, promptSnapshot: draft.promptSnapshot, summarySourceMsgId: draft.sourceSummaryMsgId },
            });
            if (char.theaterSummaryAutoHideEnabled) await hideCoveredMsgIds(draft.coveredMsgIds, draft.sourceSummaryMsgId || bridgeMsgId);
            setActiveSummaryDraft(null);
            addToast('已复用已保存总结同步到主聊天', 'success');
            return;
        }
        const savedId = await DB.saveMessage({
            charId: char.id, role: 'system', type: 'text', content: draft.content,
            metadata: {
                source: 'theater', hiddenFromUser: true, isSummary: true, summaryType: draft.summaryType,
                coveredMsgIds: draft.coveredMsgIds, sessionStartMsgId: draft.sessionStartMsgId, promptSnapshot: draft.promptSnapshot,
                ...(draft.bridgeOnSave ? { isDateContextBridge: true, bridgeType: 'summary' } : {}),
            },
        });
        if (char.theaterSummaryAutoHideEnabled) await hideCoveredMsgIds(draft.coveredMsgIds, savedId);
        if (draft.summaryType === 'auto') updateCharacter(char.id, { theaterSummaryLastAutoMsgId: draft.lastCoveredMsgId });
        if (draft.fromPendingAuto || pendingAutoSummary?.lastCoveredMsgId === draft.lastCoveredMsgId) setPendingAutoSummary(null);
        setActiveSummaryDraft(null);
        const freshMsgs = await DB.getMessagesByCharId(char.id);
        setTheaterMessages(freshMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));
        addToast(draft.bridgeOnSave ? '总结已同步到主聊天' : '总结已保存', 'success');
    };

    const discardSummaryDraft = () => {
        if (!char || !activeSummaryDraft) return;
        if (activeSummaryDraft.summaryType === 'auto') {
            updateCharacter(char.id, { theaterSummaryLastAutoMsgId: activeSummaryDraft.lastCoveredMsgId });
            setPendingAutoSummary(null);
        }
        setActiveSummaryDraft(null);
        addToast('已丢弃总结草稿', 'info');
    };

    const discardPendingAutoSummary = () => {
        if (!char || !pendingAutoSummary) return;
        updateCharacter(char.id, { theaterSummaryLastAutoMsgId: pendingAutoSummary.lastCoveredMsgId });
        setPendingAutoSummary(null);
        addToast('已丢弃自动总结', 'info');
    };

    const requestManualSummary = async () => {
        const draft = await generateSummaryDraft('manual');
        if (draft) setActiveSummaryDraft(draft);
    };

    const maybeTriggerAutoSummary = async (msgs: Message[]) => {
        if (!char || !char.theaterSummaryAutoEnabled || pendingAutoSummary || summaryGeneratingRef.current) return;
        if (!hasCompleteApiConfig(getSecondaryApiConfig())) return;
        const sessionMessages = getCurrentTheaterSessionMessages(msgs);
        const unsummarized = sessionMessages.filter(m => !m.metadata?.dateSummaryAutoHidden);
        const newCount = char.theaterSummaryLastAutoMsgId
            ? unsummarized.filter(m => m.id > char.theaterSummaryLastAutoMsgId!).length
            : unsummarized.length;
        const threshold = char.theaterSummaryAutoThreshold || 20;
        if (newCount < threshold) return;
        const draft = await generateSummaryDraft('auto');
        if (draft) setPendingAutoSummary(draft);
    };

    const compressExistingSummaries = async () => {
        if (!char) return;
        const allMsgs = await DB.getMessagesByCharId(char.id);
        const summaries = allMsgs.filter(isTheaterSummaryMessage).sort((a, b) => a.timestamp - b.timestamp);
        for (const summary of summaries) {
            if (!Array.isArray(summary.metadata?.coveredMsgIds)) continue;
            const ids = summary.metadata.coveredMsgIds.filter((id: unknown): id is number => typeof id === 'number');
            await hideCoveredMsgIds(ids, summary.id);
        }
        const freshMsgs = await DB.getMessagesByCharId(char.id);
        setTheaterMessages(freshMsgs.filter(isTheaterMessage).sort((a, b) => a.timestamp - b.timestamp));
    };

    const openSummarySettings = () => {
        if (!char) return;
        setSummaryPromptDraft(char.theaterSummaryPrompt || DEFAULT_DATE_SUMMARY_PROMPT);
        setShowSummarySettings(true);
    };

    const saveSummarySettings = () => {
        if (!char) return;
        updateCharacter(char.id, { theaterSummaryPrompt: summaryPromptDraft.trim() || DEFAULT_DATE_SUMMARY_PROMPT });
        setShowSummarySettings(false);
        addToast('总结设置已保存', 'success');
    };

    // ══════════════════════════════════════════════
    //  Exit & Sync
    // ══════════════════════════════════════════════

    const finishExit = () => {
        if (session) deleteTheaterSession(session.charId);
        setPendingAutoSummary(null);
        setActiveSummaryDraft(null);
        setShowExitReview(false);
        setMode('select');
        setSession(null);
        setChar(null);
        setCurrentLocation(null);
        setTheaterMessages([]);
        setCurrentEvent(null);
    };

    const saveRawBridgeAndExit = async () => {
        if (!char) return;
        const allMsgs = await DB.getMessagesByCharId(char.id);
        const sessionMessages = getCurrentTheaterSessionMessages(allMsgs);
        if (sessionMessages.length > 0) {
            await DB.saveMessage({
                charId: char.id, role: 'system', type: 'text',
                content: formatDateMessagesForBridge(sessionMessages, char.name, userProfile.name),
                metadata: { source: 'theater', hiddenFromUser: true, isDateContextBridge: true, bridgeType: 'raw', coveredMsgIds: sessionMessages.map(m => m.id), sessionStartMsgId: sessionMessages[0].id },
            });
            addToast('原始记录已同步到主聊天', 'success');
        }
        finishExit();
    };

    const onExitSession = async (syncMode: TheaterExitSyncMode) => {
        if (!char) return;
        if (syncMode === 'none') { finishExit(); return; }
        if (syncMode === 'raw') { await saveRawBridgeAndExit(); return; }
        // syncMode === 'summary'
        if (pendingAutoSummary) {
            setActiveSummaryDraft({ ...pendingAutoSummary, bridgeOnSave: true, fromPendingAuto: true });
            return;
        }
        const draft = await generateSummaryDraft('manual');
        if (!draft) { addToast('未同步总结，仅保存进度', 'info'); finishExit(); return; }
        setActiveSummaryDraft({ ...draft, bridgeOnSave: true });
    };

    const handleExit = useCallback(() => {
        setShowExitReview(true);
    }, []);

    // ── Render ──


    if (mode === 'select' || !char) {
        return (
            <div className="theater-app">
                <div className="theater-map" style={{ background: 'linear-gradient(180deg, #0d0015, #1a0a1e)' }}>
                    {/* Header */}
                    <div className="theater-map-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button className="theater-back-btn" onClick={closeApp}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={18} height={18}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <div>
                                <div className="theater-map-title">{is520EventActive() ? '520 约会剧场' : '约会剧场'}</div>
                                <div className="theater-map-subtitle">选择角色开始</div>
                            </div>
                        </div>
                    </div>

                    {/* Character List */}
                    <div className="theater-card-scroll">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {characters.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleSelectChar(c)}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <img
                                        src={c.avatar}
                                        alt={c.name}
                                        className="w-14 h-14 rounded-2xl object-cover"
                                        style={{ border: '2px solid rgba(255,107,157,0.3)' }}
                                    />
                                    <div className="text-left flex-1">
                                        <div className="text-white font-bold text-[15px]">{c.name}</div>
                                        <div className="text-white/30 text-xs mt-1 line-clamp-1">{c.description || '无描述'}</div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="rgba(255,255,255,0.3)" width={20} height={20}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            ))}
                            {characters.length === 0 && (
                                <div className="text-center text-white/20 py-20 text-sm">还没有角色，先去创建一个吧</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'map') {
        return (
            <div className="theater-app">
                <TheaterMap
                    locations={locations}
                    timeSlot={session?.timeSlot || 'afternoon'}
                    is520={session?.is520Event || false}
                    visitedLocationIds={session?.visitedLocationIds || []}
                    onSelectLocation={handleSelectLocation}
                    onAddLocation={handleAddLocation}
                    onDeleteCustomLocation={handleDeleteCustomLocation}
                    onBack={() => { setMode('select'); setChar(null); }}
                />
            </div>
        );
    }

    if (mode === 'session' && currentLocation) {
        return (
            <div className="theater-app">
                <TheaterSession
                    char={char}
                    userProfile={userProfile}
                    location={currentLocation}
                    timeSlot={session?.timeSlot || 'afternoon'}
                    is520={session?.is520Event || false}
                    currentEvent={currentEvent}
                    isDirectorLoading={isDirectorLoading}
                    isAiLoading={isAiLoading}
                    messages={theaterMessages}
                    onSendMessage={handleSendMessage}
                    onChangeLocation={() => setMode('map')}
                    onExit={handleExit}
                    isSummaryGenerating={isSummaryGenerating}
                    hasPendingSummary={!!pendingAutoSummary}
                    canManualSummary={canManualSummary}
                    canAutoSummary={canAutoSummary}
                    summaryDisabledReason={summaryDisabledReason}
                    onRequestSummary={requestManualSummary}
                    onReviewPendingSummary={() => pendingAutoSummary && setActiveSummaryDraft({ ...pendingAutoSummary, fromPendingAuto: true })}
                    onDiscardPendingSummary={discardPendingAutoSummary}
                    onToggleAutoSummary={(enabled) => updateCharacter(char.id, { theaterSummaryAutoEnabled: enabled })}
                    onToggleAutoHideSummary={async (enabled) => {
                        updateCharacter(char.id, { theaterSummaryAutoHideEnabled: enabled });
                        if (enabled) { await compressExistingSummaries(); addToast('已开启压缩旧记录', 'success'); }
                    }}
                    onChangeThreshold={(t) => updateCharacter(char.id, { theaterSummaryAutoThreshold: t })}
                    onOpenSummarySettings={openSummarySettings}
                />

                {/* Exit Sync Modal */}
                <Modal isOpen={showExitReview} title="离开剧场" onClose={() => setShowExitReview(false)} footer={
                    <div className="flex w-full flex-col gap-2">
                        <button onClick={() => { setShowExitReview(false); onExitSession('summary'); }} className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100">生成总结同步</button>
                        <button onClick={() => { setShowExitReview(false); onExitSession('raw'); }} className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold">同步原始记录</button>
                        <div className="flex gap-2">
                            <button onClick={() => setShowExitReview(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl text-slate-600 font-bold">留在这里</button>
                            <button onClick={() => { setShowExitReview(false); onExitSession('none'); }} className="flex-1 py-3 bg-slate-100 rounded-2xl text-slate-600 font-bold">暂不同步</button>
                        </div>
                    </div>
                }>
                    <div className="text-center text-slate-500 text-sm py-2 leading-relaxed">离开时可以把这次剧场约会同步给主聊天。同步内容用户不会在聊天列表里看到，但角色之后会自然记得。</div>
                    {session?.eventHistory && session.eventHistory.length > 0 && (
                        <div className="theater-timeline mt-3">
                            {session.eventHistory.map((evt, i) => (
                                <div key={i} className="theater-timeline-item">
                                    <div>
                                        <div className="theater-timeline-location">{evt.sceneType.toUpperCase()}</div>
                                        <div className="theater-timeline-event">{evt.event}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>

                {/* Summary Preview Modal */}
                {activeSummaryDraft && (
                    <Modal isOpen={!!activeSummaryDraft} title="剧场总结预览" onClose={() => setActiveSummaryDraft(null)} footer={
                        <>
                            <button onClick={() => navigator.clipboard.writeText(activeSummaryDraft.content).then(() => addToast('已复制', 'success')).catch(() => addToast('复制失败', 'error'))} className="flex-1 py-3 bg-slate-100 rounded-2xl text-slate-600 font-bold">复制</button>
                            <button onClick={discardSummaryDraft} className="flex-1 py-3 bg-slate-100 rounded-2xl text-slate-500 font-bold">丢弃</button>
                            <button onClick={() => saveSummaryDraft(activeSummaryDraft)} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-2xl">{activeSummaryDraft.bridgeOnSave ? '保存并同步' : '保存'}</button>
                        </>
                    }>
                        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">{renderMarkdown(activeSummaryDraft.content)}</div>
                    </Modal>
                )}

                {/* Summary Settings Modal */}
                <Modal isOpen={showSummarySettings} title="总结设置" onClose={() => setShowSummarySettings(false)} footer={
                    <>
                        <button onClick={() => setShowSummarySettings(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl text-slate-500 font-bold">取消</button>
                        <button onClick={saveSummarySettings} className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-2xl">保存</button>
                    </>
                }>
                    <div className="space-y-3">
                        <p className="text-xs leading-relaxed text-slate-400">只影响剧场总结生成，不会改动立绘、场景等其他设置。</p>
                        <textarea value={summaryPromptDraft} onChange={e => setSummaryPromptDraft(e.target.value)} rows={9} className="w-full resize-y rounded-2xl border border-slate-100 bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-700 outline-none focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-100" />
                    </div>
                </Modal>
            </div>
        );
    }

    return null;
};

export default TheaterApp;

