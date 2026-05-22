import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowCounterClockwise,
    BellRinging,
    ChatCircleText,
    Check,
    Fire,
    Heart,
    IdentificationCard,
    ImageSquare,
    PaperPlaneTilt,
    Phone,
    Sparkle,
    Target,
    UserCircle,
    X,
} from '@phosphor-icons/react';
import { useOS } from '../../context/OSContext';
import { AppID, type APIConfig, type CharacterProfile } from '../../types';
import { DB } from '../../utils/db';
import type {
    CharacterState,
    ChoicePoint,
    DirectorBeat,
    DirectorMission,
    LoveShowScene as LoveShowSceneModel,
    LoveShowSocialPost,
    LoveShowUserImpression,
    SeasonState,
} from '../../types/loveshow';
import {
    createFallbackDirectorBeat,
    createSceneFromChoice,
    createSeason,
    evaluateCharacterState,
    generateDirectorBeatWithMeta,
    generateDirectorMission,
    generateNextChoicePoint,
    generateSceneSummary,
    generateSocialPosts,
    resolveChoice,
    updateImpression,
    type ApiConfig,
    type DirectorBeatPlanSource,
} from '../../utils/loveshowEngine';
import {
    createInitialCharacterState,
    createInitialImpression,
    getActiveSeason,
    getAllCharacterStates,
    getImpression,
    getMemoryCards,
    getMissions,
    getSocialPosts,
    saveCharacterState,
    saveImpression,
    saveMemoryCard,
    saveMissions,
    saveSeason,
    saveSocialPosts,
    setActiveSeasonId,
} from '../../utils/db/loveshowStore';
import {
    buildDirectorBeatPerformanceContext,
    buildLoveShowPreamble,
    buildMultiCastLoveShowPreamble,
    buildSceneContext,
    type DirectorBeatCharacterBrief,
} from '../../utils/loveshowPrompts';
import { selectSecondaryApiConfig } from '../../utils/runtimeConfig';
import { hasCompleteApiConfig } from '../../utils/apiValidation';
import { extractContent, safeResponseJson } from '../../utils/safeApi';
import LoveShowScene, { type LoveShowTurn } from './LoveShowScene';
import './loveshow.css';

interface LoveShowUiSnapshot {
    choice: ChoicePoint | null;
    scene: LoveShowSceneModel;
    directorBeat?: DirectorBeat | null;
    directorBeatDebug?: DirectorBeatDebugInfo | null;
    transcript: LoveShowTurn[];
    completedChoiceIds: string[];
    hasUnreadPhone: boolean;
    activePhoneTab?: LoveShowPhoneTab;
    phoneMessages?: Record<string, LoveShowPhoneMessage[]>;
    phonePosition?: { x: number; y: number };
    phoneUnreadTabs?: Partial<Record<LoveShowPhoneTab, boolean>>;
    updatedAt: number;
}

type LoveShowPhoneTab = 'chat' | 'notice' | 'mission' | 'cast' | 'buzz';

interface LoveShowPhoneMessage {
    id: string;
    characterId: string;
    sender: 'character' | 'user';
    content: string;
    createdAt: number;
}

const SNAPSHOT_PREFIX = 'loveshow_ui_';
const CHOICE_HISTORY_PREFIX = 'loveshow_choice_history_';
const PHONE_WALLPAPER_MODE_KEY = 'loveshow_phone_wallpaper_mode';
const PHONE_WALLPAPER_ASSET_ID = 'loveshow_phone_wallpaper_original';
const DEFAULT_PHONE_WALLPAPER = '/images/loveshow/night-residence-window-wallpaper.png';
const MINI_PHONE_WIDTH = 306;
const MINI_PHONE_HEIGHT = 586;
const MINI_PHONE_MARGIN = 8;
const SHOW_DIRECTOR_DEBUG = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

const PHONE_TABS: Array<{
    id: LoveShowPhoneTab;
    label: string;
    icon: typeof BellRinging;
}> = [
    { id: 'chat', label: '私聊', icon: ChatCircleText },
    { id: 'notice', label: '通知', icon: BellRinging },
    { id: 'mission', label: '密令', icon: Target },
    { id: 'cast', label: '嘉宾', icon: IdentificationCard },
    { id: 'buzz', label: '热搜', icon: Fire },
];

function createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // localStorage can fail in private browsing; LoveShow should still render.
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('图片读取失败'));
        };
        reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
}

function clampPhonePosition(x: number, y: number): { x: number; y: number } {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(MINI_PHONE_MARGIN, window.innerWidth - MINI_PHONE_WIDTH - MINI_PHONE_MARGIN);
    const maxY = Math.max(MINI_PHONE_MARGIN, window.innerHeight - MINI_PHONE_HEIGHT - MINI_PHONE_MARGIN);
    return {
        x: Math.min(Math.max(MINI_PHONE_MARGIN, x), maxX),
        y: Math.min(Math.max(MINI_PHONE_MARGIN, y), maxY),
    };
}

type MountedWorldbook = NonNullable<CharacterProfile['mountedWorldbooks']>[number];

function renderWorldbookBlock(books: MountedWorldbook[], label: string): string {
    if (books.length === 0) return '';
    return [
        `### ${label}`,
        ...books.map(book => {
            const category = book.category || '通用设定';
            return `#### [${category}] ${book.title}\n${book.content}`;
        }),
        '',
    ].join('\n\n');
}

function buildParallelLoveShowCoreContext(character: CharacterProfile, userName: string, userBio?: string): string {
    const worldbooks = character.mountedWorldbooks || [];
    const top = worldbooks.filter(book => book.position === 'top');
    const afterWorldview = worldbooks.filter(book => !book.position || book.position === 'after_worldview');
    const afterImpression = worldbooks.filter(book => book.position === 'after_impression');
    const bottom = worldbooks.filter(book => book.position === 'bottom');

    return [
        '[System: LoveShow Parallel World Character Base]',
        '这是恋综专用平行时空。不要把既有聊天记忆、旧关系进展或现实聊天历史当成本节目已发生的事；但你的核心人设、世界观与世界书设定必须完整生效。',
        renderWorldbookBlock(top, '扩展设定集 · 前置 (Worldbooks · Top)'),
        `### 你的身份 (Character)\n- 名字: ${character.name}\n- 用户备注/爱称: ${character.description || '无'}\n- 核心性格/指令:\n${character.systemPrompt || '你是一个真实、自然、有边界感的恋综嘉宾。'}`,
        character.worldview?.trim() ? `### 世界观与设定 (World Settings)\n${character.worldview}` : '',
        renderWorldbookBlock(afterWorldview, '扩展设定集 (Worldbooks)'),
        `### 互动对象 (User)\n- 名字: ${userName}\n- 设定/备注: ${userBio || '无'}\n- 你和 TA 是在这档恋综里初次认识，不默认拥有恋人关系或共同回忆。`,
        renderWorldbookBlock(afterImpression, '扩展设定集 · 补充 (Worldbooks · After Impression)'),
        renderWorldbookBlock(bottom, '扩展设定集 · 最终指令 (Worldbooks · Bottom)'),
    ].filter(Boolean).join('\n\n');
}

function makeTurn(role: LoveShowTurn['role'], content: string): LoveShowTurn {
    return {
        id: createId(`turn_${role}`),
        role,
        content,
        createdAt: Date.now(),
    };
}

function getCharacterName(characters: CharacterProfile[], id: string): string {
    return characters.find(char => char.id === id)?.name || id;
}

function selectPhaseOneCharacter(
    characters: CharacterProfile[],
    activeCharacterId?: string | null,
): CharacterProfile | null {
    if (characters.length === 0) return null;
    return characters.find(char => char.id === activeCharacterId) || characters[0];
}

function selectLoveShowCast(
    characters: CharacterProfile[],
    activeCharacterId?: string | null,
): CharacterProfile[] {
    const active = selectPhaseOneCharacter(characters, activeCharacterId);
    if (!active) return [];
    const rest = characters.filter(char => char.id !== active.id);
    return [active, ...rest].slice(0, 4);
}

function getBestSubApi(): ApiConfig | null {
    const secondary = selectSecondaryApiConfig();
    return hasCompleteApiConfig(secondary) ? secondary : null;
}

function createSeedPhoneMessages(charId: string, charName: string): LoveShowPhoneMessage[] {
    return [{
        id: createId('phone_seed'),
        characterId: charId,
        sender: 'character',
        content: `我是${charName}。我刚看到节目组把手机发下来。等会儿如果镜头太近，我们就在这里说。`,
        createdAt: Date.now(),
    }];
}

function cleanPhoneReply(raw: string, charName: string): string {
    const withoutActions = raw
        .replace(/\*[\s\S]*?\*/g, '')
        .replace(new RegExp(`^${escapeRegExp(charName)}[：:]\\s*`), '')
        .replace(/^📱\s*/, '')
        .trim();
    return withoutActions.replace(/^「(.+)」$/s, '$1').trim() || raw.trim();
}

function createFallbackSocialPosts(day: number, charNames: string[], summary: string, userName: string): LoveShowSocialPost[] {
    const first = charNames[0] || '神秘嘉宾';
    return [
        {
            id: createId('post'),
            platform: 'weibo',
            username: '今天也在追心动',
            content: summary ? `Day${day} 这段有点微妙，${summary}` : `Day${day} 开播了，${first}看${userName}的眼神感觉藏了很多话。`,
            dayNumber: day,
        },
        {
            id: createId('post'),
            platform: 'xhs',
            username: '恋综观察样本',
            content: `先别急着站队，嘉宾之间那点火药味，本质上还是都在观察${userName}怎么选。`,
            likes: 128,
            dayNumber: day,
        },
    ];
}

function createWaitingScene(season: SeasonState, charIds: string[]): LoveShowSceneModel {
    return {
        id: createId('scene_waiting'),
        dayNumber: season.day,
        locationId: 'living_room',
        locationName: '合宿屋客厅',
        characterIds: charIds.slice(0, 4),
        atmosphere: '节目组正在布置下一段互动，空气里有一点被镜头看见的紧张感',
        status: 'active',
    };
}

/** Fallback opening — used when main API is unavailable */
function buildFallbackOpening(
    scene: LoveShowSceneModel,
    sceneCharacters: CharacterProfile[],
    beat?: DirectorBeat | null,
): string {
    const first = sceneCharacters[0]?.name || '第一位嘉宾';
    const second = sceneCharacters[1]?.name;
    const reactionNames = beat?.reactionOnlyCharIds
        .map(id => sceneCharacters.find(char => char.id === id)?.name || id)
        .filter(Boolean)
        .join('、');
    return [
        `*镜头从${scene.locationName}的门口推入，灯光已经亮起。${first}先抬头看向你，像是刚刚才意识到你也在这里。*`,
        second ? `${first}：「你来了。刚才节目组说今晚大家要一起破冰，我还有点没反应过来。」` : `${first}：「你来了。刚才节目组说今天会有新的安排，我还有点没反应过来。」`,
        second ? `${second}：「先坐吧，镜头一直拍着，反而更不知道该说什么了。」` : '',
        reactionNames ? `*${reactionNames}没有抢话，只是在旁边安静地看着这一幕。*` : '',
    ].filter(Boolean).join('\n');
}

/** Build a hidden instruction for the AI to open or transition a scene */
function buildOpeningInstruction(
    scene: LoveShowSceneModel,
    userName: string,
    choiceContext?: string,
    beat?: DirectorBeat | null,
): string {
    const parts: string[] = [];
    parts.push(`现在场景切换到了「${scene.locationName}」。${scene.atmosphere}`);
    if (choiceContext) {
        parts.push(`刚刚发生了：${choiceContext}`);
    }
    if (beat?.userPromptHint) {
        parts.push(`导演给用户留下的输入空间：${beat.userPromptHint}`);
    }
    parts.push(`请根据导演镜头卡开始这一小拍。写 3-6 句话，最多 1-3 位嘉宾明显发言，留出空间让${userName}回应。`);
    return parts.join('\n');
}

/** Build a brief context string describing what the user chose */
function buildChoiceContextString(
    choice: ChoicePoint,
    characters: CharacterProfile[],
    selectedOptionId?: string,
    freeInput?: string,
): string {
    const selectedName = selectedOptionId ? getCharacterName(characters, selectedOptionId) : '';
    switch (choice.type) {
        case 'group_event': return '破冰之夜开始了，所有嘉宾在客厅集合';
        case 'date_card': return `用户把今天的约会券给了${selectedName}`;
        case 'sms_target': return `用户选择给${selectedName}发匿名短信`;
        case 'sms_content': return `用户发送的匿名短信内容：「${freeInput || '...'}」`;
        case 'daily_mission': return selectedOptionId === 'reject' ? '用户暂时没有打开导演密令' : '用户接受了导演密令';
        case 'location_visit': return `用户来到了${selectedName || '合宿屋某处'}`;
        case 'observatory': return `用户在观察室偷看${selectedName}的独白`;
        default: return '用户做出了一个选择';
    }
}

function formatTranscript(turns: LoveShowTurn[], userName: string): string {
    return turns
        .map(turn => turn.role === 'user' ? `${userName}：${turn.content}` : turn.content)
        .join('\n');
}

type BeatUpdateStrength = 'strong' | 'medium' | 'weak';

function getBeatUpdateStrength(beat: DirectorBeat | null, charId: string): BeatUpdateStrength {
    if (!beat) return 'medium';
    if (beat.speakers.some(speaker => speaker.charId === charId)) return 'strong';
    if (beat.cameraFocus.some(focus => focus.charId === charId)) return 'medium';
    return 'weak';
}

function shouldPauseForChoice(choice: ChoicePoint): boolean {
    return choice.type === 'date_card';
}

function normalizeApiConfig(config: APIConfig): ApiConfig | null {
    return hasCompleteApiConfig(config) ? config : null;
}

interface LoveShowMainApiOptions {
    sceneOverride?: LoveShowSceneModel;
    directorBeatOverride?: DirectorBeat | null;
    actingCharacterId?: string;
    mode?: 'scene' | 'phone';
}

interface DirectorBeatDebugInfo {
    source: DirectorBeatPlanSource;
    issues: string[];
    generatedAt: number;
}

const LoveShowApp: React.FC = () => {
    const {
        activeCharacterId,
        addToast,
        apiConfig,
        characters,
        closeApp,
        openApp,
        userProfile,
    } = useOS();

    const targetCharacter = useMemo(
        () => selectPhaseOneCharacter(characters, activeCharacterId),
        [activeCharacterId, characters],
    );
    const initialCast = useMemo(
        () => selectLoveShowCast(characters, activeCharacterId),
        [activeCharacterId, characters],
    );
    const userName = userProfile?.name?.trim() || '你';

    const [season, setSeason] = useState<SeasonState | null>(null);
    const [choice, setChoice] = useState<ChoicePoint | null>(null);
    const [scene, setScene] = useState<LoveShowSceneModel | null>(null);
    const [directorBeat, setDirectorBeat] = useState<DirectorBeat | null>(null);
    const [directorBeatDebug, setDirectorBeatDebug] = useState<DirectorBeatDebugInfo | null>(null);
    const [transcript, setTranscript] = useState<LoveShowTurn[]>([]);
    const [completedChoiceIds, setCompletedChoiceIds] = useState<string[]>([]);
    const [charState, setCharState] = useState<CharacterState | null>(null);
    const [impression, setImpression] = useState<LoveShowUserImpression | null>(null);
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [activePhoneTab, setActivePhoneTab] = useState<LoveShowPhoneTab>('notice');
    const [hasUnreadPhone, setHasUnreadPhone] = useState(true);
    const [phoneUnreadTabs, setPhoneUnreadTabs] = useState<Partial<Record<LoveShowPhoneTab, boolean>>>({ notice: true });
    const [phoneMessages, setPhoneMessages] = useState<Record<string, LoveShowPhoneMessage[]>>({});
    const [selectedChatCharacterId, setSelectedChatCharacterId] = useState('');
    const [phoneDraft, setPhoneDraft] = useState('');
    const [phonePosition, setPhonePosition] = useState(() => clampPhonePosition(72, 96));
    const [isPhoneSending, setIsPhoneSending] = useState(false);
    const [isGeneratingBuzz, setIsGeneratingBuzz] = useState(false);
    const [phoneRevision, setPhoneRevision] = useState(0);
    const [selectedChoiceId, setSelectedChoiceId] = useState('');
    const [freeChoiceInput, setFreeChoiceInput] = useState('');
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isClosingScene, setIsClosingScene] = useState(false);
    const [closingStatus, setClosingStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pendingRetry, setPendingRetry] = useState(false);
    const [lastSummary, setLastSummary] = useState<string | null>(null);
    const [needsOpening, setNeedsOpening] = useState(false);
    const [phoneWallpaperUrl, setPhoneWallpaperUrl] = useState(DEFAULT_PHONE_WALLPAPER);
    const [hasCustomPhoneWallpaper, setHasCustomPhoneWallpaper] = useState(false);
    const phoneWallpaperInputRef = useRef<HTMLInputElement | null>(null);
    const chatThreadRef = useRef<HTMLDivElement | null>(null);
    const phoneVisibilityRef = useRef({
        open: phoneOpen,
        tab: activePhoneTab,
    });
    const phoneDragRef = useRef({
        pointerId: -1,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
    });
    const phoneDragCleanupRef = useRef<(() => void) | null>(null);

    const sceneSummaries = useMemo(
        () => season ? getMemoryCards(season.seasonId).map(card => card.description) : [],
        [season?.seasonId, lastSummary],
    );
    const missions = useMemo(
        () => season ? getMissions(season.seasonId) : [],
        [season?.seasonId, phoneRevision],
    );
    const socialPosts = useMemo(
        () => season ? getSocialPosts(season.seasonId, season.day) : [],
        [season?.day, season?.seasonId, phoneRevision],
    );
    const chatCharacters = useMemo(
        () => season
            ? season.charIds
                .map(id => characters.find(char => char.id === id))
                .filter((char): char is CharacterProfile => Boolean(char))
            : [],
        [characters, season?.charIds],
    );
    const castCharacterBriefs = useMemo<DirectorBeatCharacterBrief[]>(() => {
        if (!season) return [];
        const states = getAllCharacterStates(season.seasonId);
        return chatCharacters.map(char => ({
            id: char.id,
            name: char.name,
            profile: [
                char.description,
                char.systemPrompt,
                ...(char.mountedWorldbooks || []).slice(0, 3).map(book => `${book.title}：${book.content}`),
            ].filter(Boolean).join('\n'),
            worldview: char.worldview,
            state: states.find(state => state.characterId === char.id) || null,
            impression: getImpression(season.seasonId, char.id),
        }));
    }, [chatCharacters, lastSummary, phoneRevision, season?.seasonId]);
    const focusCharacterId = directorBeat?.cameraFocus[0]?.charId || targetCharacter?.id || '';
    const focusCharacter = chatCharacters.find(char => char.id === focusCharacterId) || targetCharacter;
    const focusCharacterState = focusCharacter && season
        ? getAllCharacterStates(season.seasonId).find(state => state.characterId === focusCharacter.id) || null
        : charState;
    const directorBeatDebugSummary = useMemo(() => {
        if (!directorBeat) return null;
        const nameById = new Map(chatCharacters.map(char => [char.id, char.name]));
        const nameOf = (id: string) => nameById.get(id) || id;
        return {
            source: directorBeatDebug?.source || 'api',
            present: directorBeat.presentCharIds.map(nameOf).join(' / ') || '无',
            focus: directorBeat.cameraFocus
                .map(item => `${nameOf(item.charId)} ${item.shotType}`)
                .join('，') || '无',
            speakers: directorBeat.speakers
                .map(item => `${nameOf(item.charId)} ${item.role}`)
                .join('，') || '无',
            reactions: directorBeat.reactionOnlyCharIds.map(nameOf).join(' / ') || '无',
            ending: directorBeat.endingMode,
            issues: directorBeatDebug?.issues || [],
        };
    }, [chatCharacters, directorBeat, directorBeatDebug]);
    const activePhoneMessages = selectedChatCharacterId ? phoneMessages[selectedChatCharacterId] || [] : [];
    const hasAnyUnreadPhone = hasUnreadPhone || Object.values(phoneUnreadTabs).some(Boolean);

    const resolveNextChoice = useCallback((nextSeason: SeasonState, history: string[]) => {
        const states = getAllCharacterStates(nextSeason.seasonId);
        return generateNextChoicePoint(nextSeason, states, history);
    }, []);

    const markPhoneTabUnread = useCallback((tab: LoveShowPhoneTab) => {
        const current = phoneVisibilityRef.current;
        if (current.open && current.tab === tab) return;
        setHasUnreadPhone(true);
        setPhoneUnreadTabs(prev => ({ ...prev, [tab]: true }));
    }, []);

    useEffect(() => {
        phoneVisibilityRef.current = {
            open: phoneOpen,
            tab: activePhoneTab,
        };
    }, [activePhoneTab, phoneOpen]);

    useEffect(() => {
        const handleResize = () => {
            setPhonePosition(prev => clampPhonePosition(prev.x, prev.y));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (activePhoneTab !== 'chat') return;
        const thread = chatThreadRef.current;
        if (!thread) return;
        thread.scrollTop = thread.scrollHeight;
    }, [activePhoneMessages.length, activePhoneTab, isPhoneSending, selectedChatCharacterId]);

    useEffect(() => {
        let cancelled = false;
        const loadPhoneWallpaper = async () => {
            try {
                if (localStorage.getItem(PHONE_WALLPAPER_MODE_KEY) !== 'custom') return;
                const savedWallpaper = await DB.getAsset(PHONE_WALLPAPER_ASSET_ID);
                if (!cancelled && savedWallpaper) {
                    setPhoneWallpaperUrl(savedWallpaper);
                    setHasCustomPhoneWallpaper(true);
                }
            } catch {
                // Wallpaper is decorative; keep the built-in image if IndexedDB is unavailable.
            }
        };
        void loadPhoneWallpaper();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!targetCharacter || initialCast.length === 0) {
            setSeason(null);
            setChoice(null);
            setScene(null);
            setDirectorBeat(null);
            setDirectorBeatDebug(null);
            setTranscript([]);
            setCharState(null);
            setImpression(null);
            return;
        }

        const desiredCastIds = initialCast.map(char => char.id);
        const desiredCastCount = Math.min(4, characters.length);
        let nextSeason = getActiveSeason();
        const hasUsableSeason = Boolean(
            nextSeason
            && nextSeason.charIds.length >= desiredCastCount
            && nextSeason.charIds.every(id => characters.some(char => char.id === id))
            && (!activeCharacterId || nextSeason.charIds.includes(activeCharacterId)),
        );

        if (!nextSeason || !hasUsableSeason) {
            nextSeason = createSeason(desiredCastIds);
            saveSeason(nextSeason);
            setActiveSeasonId(nextSeason.seasonId);
        } else {
            nextSeason = { ...nextSeason, lastActiveAt: Date.now() };
            saveSeason(nextSeason);
        }

        const seasonCharacters = nextSeason.charIds
            .map(id => characters.find(char => char.id === id))
            .filter((char): char is CharacterProfile => Boolean(char));
        const seasonCharacterIds = seasonCharacters.map(char => char.id);
        const primaryCharId = seasonCharacterIds.includes(targetCharacter.id)
            ? targetCharacter.id
            : seasonCharacterIds[0];

        const nextStates = seasonCharacterIds.map(charId => {
            let state = getAllCharacterStates(nextSeason.seasonId).find(item => item.characterId === charId);
            if (!state) {
                state = createInitialCharacterState(charId);
                saveCharacterState(nextSeason.seasonId, state);
            }
            return state;
        });
        const nextState = nextStates.find(state => state.characterId === primaryCharId) || nextStates[0] || null;

        const nextImpressions = seasonCharacterIds.map(charId => {
            let item = getImpression(nextSeason.seasonId, charId);
            if (!item) {
                item = createInitialImpression(charId);
                saveImpression(nextSeason.seasonId, item);
            }
            return item;
        });
        const nextImpression = nextImpressions.find(item => item.characterId === primaryCharId) || nextImpressions[0] || null;

        if (!nextState || !nextImpression) {
            setError('LoveShow 需要至少一位可用嘉宾');
            return;
        }

        const history = readJson<string[]>(CHOICE_HISTORY_PREFIX + nextSeason.seasonId, []);
        const snapshot = readJson<LoveShowUiSnapshot | null>(SNAPSHOT_PREFIX + nextSeason.seasonId, null);
        const seedMessages = (restoredMessages: Record<string, LoveShowPhoneMessage[]> = {}) => {
            const seeded = { ...restoredMessages };
            for (const char of seasonCharacters) {
                seeded[char.id] = seeded[char.id] || createSeedPhoneMessages(char.id, char.name);
            }
            return seeded;
        };

        if (snapshot?.choice && snapshot?.scene && Array.isArray(snapshot.transcript)) {
            const restoredHistory = snapshot.completedChoiceIds || history;
            const normalizedHistory = nextSeason.day === 1
                && snapshot.scene.locationId === 'living_room'
                && snapshot.scene.characterIds.length > 1
                && !restoredHistory.includes('d1_group_event')
                ? [...restoredHistory, 'd1_group_event']
                : restoredHistory;
            setChoice(snapshot.choice);
            setScene(snapshot.scene);
            setDirectorBeat(snapshot.directorBeat || null);
            setDirectorBeatDebug(snapshot.directorBeatDebug || null);
            setTranscript(snapshot.transcript);
            setCompletedChoiceIds(normalizedHistory);
            setHasUnreadPhone(snapshot.hasUnreadPhone);
            setActivePhoneTab(snapshot.activePhoneTab || 'notice');
            setPhoneUnreadTabs(snapshot.phoneUnreadTabs || (snapshot.hasUnreadPhone ? { notice: true } : {}));
            setPhonePosition(snapshot.phonePosition ? clampPhonePosition(snapshot.phonePosition.x, snapshot.phonePosition.y) : clampPhonePosition(72, 96));
            setPhoneMessages(seedMessages(snapshot.phoneMessages));
            writeJson(CHOICE_HISTORY_PREFIX + nextSeason.seasonId, normalizedHistory);
        } else {
            const nextChoice = resolveNextChoice(nextSeason, history);
            const autoStartedGroup = nextChoice.type === 'group_event';
            const nextHistory = autoStartedGroup
                ? Array.from(new Set([...history, nextChoice.id]))
                : history;
            const autoScene = nextChoice.type === 'group_event'
                ? { ...createSceneFromChoice(nextSeason, nextChoice), status: 'active' as const }
                : createWaitingScene(nextSeason, seasonCharacterIds);

            setChoice(nextChoice);
            setScene(autoScene);
            setDirectorBeat(null);
            setDirectorBeatDebug(null);
            setTranscript([]);  // Start empty, AI will generate the opening
            setCompletedChoiceIds(nextHistory);
            setHasUnreadPhone(true);
            setActivePhoneTab('notice');
            setPhoneUnreadTabs({ notice: true, chat: true });
            setPhoneMessages(seedMessages());
            writeJson(CHOICE_HISTORY_PREFIX + nextSeason.seasonId, nextHistory);
            setNeedsOpening(true);  // Trigger AI opening in a separate effect
        }

        setSeason(nextSeason);
        setCharState(nextState);
        setImpression(nextImpression);
        setSelectedChatCharacterId(primaryCharId);
    }, [activeCharacterId, characters, initialCast, resolveNextChoice, targetCharacter]);

    useEffect(() => {
        if (!choice) return;
        setSelectedChoiceId(choice.options?.[0]?.id || '');
        setFreeChoiceInput('');
    }, [choice?.id]);

    useEffect(() => {
        if (!season || !scene) return;
        const snapshot: LoveShowUiSnapshot = {
            choice,
            scene,
            directorBeat,
            directorBeatDebug,
            transcript,
            completedChoiceIds,
            hasUnreadPhone,
            activePhoneTab,
            phoneMessages,
            phonePosition,
            phoneUnreadTabs,
            updatedAt: Date.now(),
        };
        writeJson(SNAPSHOT_PREFIX + season.seasonId, snapshot);
        writeJson(CHOICE_HISTORY_PREFIX + season.seasonId, completedChoiceIds);
    }, [activePhoneTab, choice, completedChoiceIds, directorBeat, directorBeatDebug, hasUnreadPhone, phoneMessages, phonePosition, phoneUnreadTabs, scene, season, transcript]);

    const callMainApi = useCallback(async (
        turnsForPrompt: LoveShowTurn[],
        options: LoveShowMainApiOptions = {},
    ): Promise<string> => {
        if (!targetCharacter || !season) {
            throw new Error('LoveShow scene is not ready');
        }
        const currentScene = options.sceneOverride || scene;
        if (!currentScene) {
            throw new Error('LoveShow scene is not ready');
        }

        const mainApi = normalizeApiConfig(apiConfig);
        if (!mainApi) {
            throw new Error('请先在设置里配置主 API');
        }

        const actingCharacter = options.actingCharacterId
            ? characters.find(char => char.id === options.actingCharacterId) || targetCharacter
            : targetCharacter;
        const actingState = getAllCharacterStates(season.seasonId)
            .find(state => state.characterId === actingCharacter.id)
            || createInitialCharacterState(actingCharacter.id);
        const actingImpression = getImpression(season.seasonId, actingCharacter.id);
        const activeBeat = options.directorBeatOverride || directorBeat;
        const mode = options.mode || 'scene';

        const systemPrompt = mode === 'phone'
            ? [
                buildParallelLoveShowCoreContext(actingCharacter, userName, userProfile?.bio),
                buildLoveShowPreamble(actingCharacter.name, userName, season, actingState, actingImpression),
                buildSceneContext(currentScene, sceneSummaries),
                '你现在只回复小手机私聊。只扮演当前私聊嘉宾，不要替用户做选择。',
            ].filter(Boolean).join('\n\n')
            : [
                buildMultiCastLoveShowPreamble(userName, season, castCharacterBriefs, userProfile?.bio),
                buildSceneContext(currentScene, sceneSummaries),
                activeBeat ? buildDirectorBeatPerformanceContext(activeBeat, castCharacterBriefs) : '',
                '只演当前这一小拍。不要替用户做选择，不要输出系统标签，不要解释镜头卡。',
            ].filter(Boolean).join('\n\n');

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            ...turnsForPrompt.slice(-14).map(turn => ({
                role: turn.role === 'user' ? 'user' as const : 'assistant' as const,
                content: turn.role === 'user' ? `${userName}：${turn.content}` : turn.content,
            })),
        ];

        const response = await fetch(`${mainApi.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mainApi.apiKey}`,
            },
            body: JSON.stringify({
                model: mainApi.model,
                messages,
                temperature: actingCharacter.dateTemperature ?? 0.85,
            }),
        });

        if (!response.ok) {
            throw new Error(`主 API 请求失败：${response.status} ${response.statusText}`);
        }

        const data = await safeResponseJson(response);
        const content = extractContent(data);
        if (!content) throw new Error('主 API 没有返回有效文本');
        return content;
    }, [apiConfig, castCharacterBriefs, characters, directorBeat, scene, sceneSummaries, season, targetCharacter, userName, userProfile?.bio]);

    const planDirectorBeat = useCallback(async (
        targetScene: LoveShowSceneModel,
        turnsForPrompt: LoveShowTurn[],
        choiceContext?: string,
    ): Promise<{ beat: DirectorBeat; plannedScene: LoveShowSceneModel }> => {
        if (!season) {
            throw new Error('LoveShow season is not ready');
        }

        const input = {
            season,
            scene: targetScene,
            characters: castCharacterBriefs,
            sceneSummaries,
            recentDialogue: formatTranscript(turnsForPrompt.filter(turn => turn.role !== 'system').slice(-10), userName),
            choiceContext,
        };

        let nextBeat: DirectorBeat;
        let debugInfo: DirectorBeatDebugInfo;
        const subApi = getBestSubApi();
        if (subApi) {
            try {
                const plan = await generateDirectorBeatWithMeta(subApi, input);
                nextBeat = plan.beat;
                debugInfo = {
                    source: plan.source,
                    issues: plan.issues,
                    generatedAt: Date.now(),
                };
            } catch (err) {
                nextBeat = createFallbackDirectorBeat(input);
                debugInfo = {
                    source: 'fallback',
                    issues: [err instanceof Error ? err.message : 'DirectorBeat API call failed'],
                    generatedAt: Date.now(),
                };
            }
        } else {
            nextBeat = createFallbackDirectorBeat(input);
            debugInfo = {
                source: 'fallback',
                issues: ['No secondary API configured'],
                generatedAt: Date.now(),
            };
        }

        const plannedScene = nextBeat.presentCharIds.length > 0
            ? { ...targetScene, characterIds: nextBeat.presentCharIds }
            : targetScene;

        setDirectorBeat(nextBeat);
        setDirectorBeatDebug(debugInfo);
        if (SHOW_DIRECTOR_DEBUG) {
            console.info('[LoveShow DirectorBeat]', {
                beat: nextBeat,
                source: debugInfo.source,
                issues: debugInfo.issues,
            });
        }
        setScene(prev => (prev?.id === targetScene.id ? plannedScene : prev));
        return { beat: nextBeat, plannedScene };
    }, [castCharacterBriefs, sceneSummaries, season, userName]);

    const requestAssistantReply = useCallback(async (turnsForPrompt: LoveShowTurn[]) => {
        setIsSending(true);
        setError(null);
        setPendingRetry(false);
        try {
            if (!scene) throw new Error('LoveShow scene is not ready');
            const { beat, plannedScene } = await planDirectorBeat(scene, turnsForPrompt);
            const reply = await callMainApi(turnsForPrompt, {
                sceneOverride: plannedScene,
                directorBeatOverride: beat,
            });
            setTranscript(prev => [...prev, makeTurn('assistant', reply)]);
        } catch (err) {
            const message = err instanceof Error ? err.message : '发送失败';
            setError(message);
            setPendingRetry(true);
            addToast?.(message, 'error');
        } finally {
            setIsSending(false);
        }
    }, [addToast, callMainApi, planDirectorBeat, scene]);

    /** Call main API to generate an AI scene opening (or react to a choice) */
    const requestAISceneOpening = useCallback(async (
        targetScene: LoveShowSceneModel,
        choiceContext?: string,
    ) => {
        if (!targetCharacter) return;
        setIsSending(true);
        setError(null);
        try {
            const openingSeed = choiceContext ? [makeTurn('user', choiceContext)] : [];
            const { beat, plannedScene } = await planDirectorBeat(targetScene, openingSeed, choiceContext);
            const instruction = buildOpeningInstruction(
                plannedScene,
                userName,
                choiceContext,
                beat,
            );
            // Send as a hidden user instruction — AI responds in character
            const instructionTurn = makeTurn('user', instruction);
            const reply = await callMainApi([instructionTurn], {
                sceneOverride: plannedScene,
                directorBeatOverride: beat,
            });
            setTranscript(prev => [...prev, makeTurn('assistant', reply)]);
        } catch {
            // Fallback to hardcoded opening if API fails
            const beat = directorBeat || createFallbackDirectorBeat({
                season: season || createSeason(targetScene.characterIds),
                scene: targetScene,
                characters: castCharacterBriefs,
                sceneSummaries,
                recentDialogue: '',
                choiceContext,
            });
            setDirectorBeat(beat);
            setDirectorBeatDebug({
                source: 'fallback',
                issues: ['Scene opening used fallback text after model call failed'],
                generatedAt: Date.now(),
            });
            const sceneCharacters = targetScene.characterIds
                .map(id => characters.find(char => char.id === id))
                .filter((char): char is CharacterProfile => Boolean(char));
            const fallback = buildFallbackOpening(targetScene, sceneCharacters, beat);
            setTranscript(prev => [...prev, makeTurn('assistant', fallback)]);
        } finally {
            setIsSending(false);
        }
    }, [callMainApi, castCharacterBriefs, characters, directorBeat, planDirectorBeat, sceneSummaries, season, targetCharacter, userName]);

    // Trigger AI scene opening when needed (after state is settled)
    useEffect(() => {
        if (!needsOpening || !scene || !season || !charState || !targetCharacter || isSending) return;
        setNeedsOpening(false);
        void requestAISceneOpening(scene);
    }, [needsOpening, scene, season, charState, targetCharacter, isSending, requestAISceneOpening]);


    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isSending) return;

        const userTurn = makeTurn('user', text);
        const nextTranscript = [...transcript, userTurn];
        setTranscript(nextTranscript);
        setInput('');
        void requestAssistantReply(nextTranscript);
    }, [input, isSending, requestAssistantReply, transcript]);

    const handleRetry = useCallback(() => {
        if (!pendingRetry || isSending) return;
        void requestAssistantReply(transcript);
    }, [isSending, pendingRetry, requestAssistantReply, transcript]);

    const handleOpenPhone = useCallback(() => {
        setPhoneOpen(true);
        setHasUnreadPhone(false);
        setPhoneUnreadTabs(prev => ({ ...prev, [activePhoneTab]: false }));
    }, [activePhoneTab]);

    const handlePhoneTabSelect = useCallback((tab: LoveShowPhoneTab) => {
        setActivePhoneTab(tab);
        setHasUnreadPhone(false);
        setPhoneUnreadTabs(prev => ({ ...prev, [tab]: false }));
    }, []);

    const handlePhoneWallpaperSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            addToast?.('请选择图片文件', 'error');
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            await DB.saveAsset(PHONE_WALLPAPER_ASSET_ID, dataUrl);
            localStorage.setItem(PHONE_WALLPAPER_MODE_KEY, 'custom');
            setPhoneWallpaperUrl(dataUrl);
            setHasCustomPhoneWallpaper(true);
            addToast?.('心动手机壁纸已更新', 'success');
        } catch {
            addToast?.('壁纸保存失败，可能是图片太大或浏览器存储空间不足', 'error');
        }
    }, [addToast]);

    const handleResetPhoneWallpaper = useCallback(async () => {
        try {
            await DB.deleteAsset(PHONE_WALLPAPER_ASSET_ID);
        } catch {
            // Reset the visible state even if IndexedDB cleanup fails.
        }
        localStorage.removeItem(PHONE_WALLPAPER_MODE_KEY);
        setPhoneWallpaperUrl(DEFAULT_PHONE_WALLPAPER);
        setHasCustomPhoneWallpaper(false);
        addToast?.('已恢复默认壁纸', 'success');
    }, [addToast]);

    const handlePhoneDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        phoneDragCleanupRef.current?.();

        phoneDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: phonePosition.x,
            originY: phonePosition.y,
        };

        const handleMove = (moveEvent: PointerEvent) => {
            const drag = phoneDragRef.current;
            if (drag.pointerId !== moveEvent.pointerId) return;
            moveEvent.preventDefault();
            setPhonePosition(clampPhonePosition(
                drag.originX + moveEvent.clientX - drag.startX,
                drag.originY + moveEvent.clientY - drag.startY,
            ));
        };

        const handleEnd = (endEvent: PointerEvent) => {
            if (phoneDragRef.current.pointerId === endEvent.pointerId) {
                phoneDragRef.current.pointerId = -1;
            }
            cleanup();
        };

        const cleanup = () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleEnd);
            window.removeEventListener('pointercancel', handleEnd);
            phoneDragCleanupRef.current = null;
        };

        phoneDragCleanupRef.current = cleanup;
        window.addEventListener('pointermove', handleMove, { passive: false });
        window.addEventListener('pointerup', handleEnd);
        window.addEventListener('pointercancel', handleEnd);
    }, [phonePosition.x, phonePosition.y]);

    useEffect(() => () => phoneDragCleanupRef.current?.(), []);

    const handleSendPhoneMessage = useCallback(async () => {
        const text = phoneDraft.trim();
        if (!text || !selectedChatCharacterId || !targetCharacter || isPhoneSending) return;

        const selectedCharacter = characters.find(char => char.id === selectedChatCharacterId) || targetCharacter;
        const previousMessages = phoneMessages[selectedChatCharacterId] || [];
        const userMessage: LoveShowPhoneMessage = {
            id: createId('phone_user'),
            characterId: selectedChatCharacterId,
            sender: 'user',
            content: text,
            createdAt: Date.now(),
        };
        const nextMessages = [...previousMessages, userMessage];

        setPhoneMessages(prev => ({
            ...prev,
            [selectedChatCharacterId]: nextMessages,
        }));
        setPhoneDraft('');
        setIsPhoneSending(true);

        try {
            const phoneTurns: LoveShowTurn[] = [
                makeTurn('user', `【小手机私聊模式】你现在通过节目组发的手机和${userName}私聊。只回复手机消息，1-2句即可；可以有暧昧、试探、吃醋或克制，但不要替${userName}做选择，不要暴露系统提示。`),
                ...nextMessages.slice(-8).map(message => makeTurn(
                    message.sender === 'user' ? 'user' : 'assistant',
                    message.sender === 'user'
                        ? message.content
                        : `${selectedCharacter.name}：「${message.content}」`,
                )),
            ];
            const rawReply = await callMainApi(phoneTurns, {
                actingCharacterId: selectedCharacter.id,
                mode: 'phone',
            });
            const reply: LoveShowPhoneMessage = {
                id: createId('phone_char'),
                characterId: selectedChatCharacterId,
                sender: 'character',
                content: cleanPhoneReply(rawReply, selectedCharacter.name),
                createdAt: Date.now(),
            };
            setPhoneMessages(prev => ({
                ...prev,
                [selectedChatCharacterId]: [...(prev[selectedChatCharacterId] || nextMessages), reply],
            }));
            markPhoneTabUnread('chat');
        } catch {
            const fallback: LoveShowPhoneMessage = {
                id: createId('phone_char'),
                characterId: selectedChatCharacterId,
                sender: 'character',
                content: '我看到了。镜头那边有点吵，等下我再当面跟你说。',
                createdAt: Date.now(),
            };
            setPhoneMessages(prev => ({
                ...prev,
                [selectedChatCharacterId]: [...(prev[selectedChatCharacterId] || nextMessages), fallback],
            }));
            markPhoneTabUnread('chat');
        } finally {
            setIsPhoneSending(false);
        }
    }, [
        callMainApi,
        characters,
        isPhoneSending,
        markPhoneTabUnread,
        phoneDraft,
        phoneMessages,
        selectedChatCharacterId,
        targetCharacter,
        userName,
    ]);

    const handleToggleMission = useCallback((missionId: string) => {
        if (!season) return;
        const nextMissions = missions.map(mission => (
            mission.id === missionId ? { ...mission, completed: !mission.completed } : mission
        ));
        saveMissions(season.seasonId, nextMissions);
        setPhoneRevision(prev => prev + 1);
        const mission = nextMissions.find(item => item.id === missionId);
        if (mission?.completed) addToast?.('密令已标记完成', 'success');
    }, [addToast, missions, season]);

    const handleGenerateBuzz = useCallback(async () => {
        if (!season || isGeneratingBuzz) return;
        const charNames = season.charIds.map(id => getCharacterName(characters, id));
        const summary = sceneSummaries.slice(-3).join('；');
        setIsGeneratingBuzz(true);
        try {
            const subApi = getBestSubApi();
            const posts = subApi
                ? await generateSocialPosts(subApi, season.day, summary || '节目刚刚开始，嘉宾还在围绕用户互相试探', charNames, userName)
                : createFallbackSocialPosts(season.day, charNames, summary, userName);
            saveSocialPosts(season.seasonId, season.day, posts);
            setPhoneRevision(prev => prev + 1);
            markPhoneTabUnread('buzz');
        } catch {
            const fallbackPosts = createFallbackSocialPosts(season.day, charNames, summary, userName);
            saveSocialPosts(season.seasonId, season.day, fallbackPosts);
            setPhoneRevision(prev => prev + 1);
            markPhoneTabUnread('buzz');
        } finally {
            setIsGeneratingBuzz(false);
        }
    }, [characters, isGeneratingBuzz, markPhoneTabUnread, sceneSummaries, season, userName]);

    const maybeSaveMission = useCallback(async (nextSeason: SeasonState, selectedOption?: string) => {
        if (!choice || choice.type !== 'daily_mission' || selectedOption === 'reject') return;
        const existing = getMissions(nextSeason.seasonId);
        if (existing.some(mission => mission.dayNumber === nextSeason.day)) return;

        const charNames = nextSeason.charIds.map(id => getCharacterName(characters, id));
        const fallback = {
            id: createId('mission'),
            dayNumber: nextSeason.day,
            description: `找机会和${charNames[0] || '一位嘉宾'}单独说一句真心话`,
            reward: '解锁一次观察室视角',
            completed: false,
        };

        const subApi = getBestSubApi();
        if (!subApi) {
            saveMissions(nextSeason.seasonId, [...existing, fallback]);
            setPhoneRevision(prev => prev + 1);
            markPhoneTabUnread('mission');
            return;
        }

        try {
            const mission = await generateDirectorMission(
                subApi,
                nextSeason.day,
                charNames,
                sceneSummaries.slice(-3).join('；') || '第一天刚刚开始',
            );
            saveMissions(nextSeason.seasonId, [...existing, mission]);
            setPhoneRevision(prev => prev + 1);
            markPhoneTabUnread('mission');
        } catch {
            saveMissions(nextSeason.seasonId, [...existing, fallback]);
            setPhoneRevision(prev => prev + 1);
            markPhoneTabUnread('mission');
        }
    }, [characters, choice, markPhoneTabUnread, sceneSummaries]);

    const handleChoiceSubmit = useCallback(() => {
        if (!season || !choice) return;

        const selected = choice.options?.length ? selectedChoiceId : undefined;
        if (choice.options?.length && !selected) {
            setError('请先选择一个选项');
            return;
        }
        if (choice.freeInput && choice.mandatory && !freeChoiceInput.trim()) {
            setError('这次需要写下你的选择');
            return;
        }
        if (completedChoiceIds.includes(choice.id)) {
            setChoice(null);
            setPhoneOpen(false);
            setHasUnreadPhone(false);
            setPhoneUnreadTabs(prev => ({ ...prev, notice: false }));
            setError(null);
            return;
        }
        if (choice.type === 'daily_mission' && selected === 'reject') {
            setPhoneOpen(false);
            setError(null);
            return;
        }

        const nextHistory = Array.from(new Set([...completedChoiceIds, choice.id]));
        const nextSeason = resolveChoice(season, choice.id, selected, freeChoiceInput.trim());
        const nextScene = {
            ...createSceneFromChoice(nextSeason, choice, selected),
            status: 'active' as const,
        };

        // Build context string describing the choice for AI
        const choiceContext = buildChoiceContextString(
            choice, characters, selected, freeChoiceInput.trim(),
        );

        saveSeason(nextSeason);
        writeJson(CHOICE_HISTORY_PREFIX + nextSeason.seasonId, nextHistory);
        void maybeSaveMission(nextSeason, selected);

        setSeason(nextSeason);
        setCompletedChoiceIds(nextHistory);
        setScene(nextScene);
        // Don't reset transcript — keep conversation continuous.
        // Don't generate next choice yet — wait until scene completes.
        setChoice(null);
        setPhoneOpen(false);
        setHasUnreadPhone(false);
        setPhoneUnreadTabs(prev => ({ ...prev, notice: false }));
        setError(null);

        // Call AI to react to the choice within the current scene
        void requestAISceneOpening(nextScene, choiceContext);
    }, [
        characters,
        choice,
        completedChoiceIds,
        freeChoiceInput,
        maybeSaveMission,
        requestAISceneOpening,
        season,
        selectedChoiceId,
    ]);

    const handleCompleteScene = useCallback(async () => {
        if (!season || !scene || !targetCharacter) {
            setError('场景还没准备好，稍等一下再收场');
            return;
        }

        setIsClosingScene(true);
        setClosingStatus('准备收束场景...');
        setError(null);
        const rawDialogue = formatTranscript(transcript, userName);
        const subApi = getBestSubApi();
        const presentCharacters = scene.characterIds
            .map(id => characters.find(char => char.id === id))
            .filter((char): char is CharacterProfile => Boolean(char));
        const summaryCastName = presentCharacters.map(char => char.name).join('、') || targetCharacter.name;
        let summary = `${summaryCastName}和${userName}在${scene.locationName}完成了一段节目互动`;
        const fallbackTargetState = charState || createInitialCharacterState(targetCharacter.id);
        const fallbackTargetImpression = impression || createInitialImpression(targetCharacter.id);

        try {
            if (subApi && rawDialogue.trim()) {
                setClosingStatus('正在请求副 API：生成场景摘要...');
                summary = await generateSceneSummary(subApi, summaryCastName, userName, rawDialogue);
            }

            setClosingStatus('正在保存场景摘要...');
            saveMemoryCard(season.seasonId, {
                sceneId: scene.id,
                dayNumber: season.day,
                description: summary,
                characters: scene.characterIds,
                timestamp: Date.now(),
            });

            const updatedStates: CharacterState[] = [];
            const updatedImpressions: LoveShowUserImpression[] = [];

            for (const char of presentCharacters) {
                const currentState = getAllCharacterStates(season.seasonId)
                    .find(state => state.characterId === char.id)
                    || createInitialCharacterState(char.id);
                const currentImpression = getImpression(season.seasonId, char.id)
                    || createInitialImpression(char.id);
                const updateStrength = getBeatUpdateStrength(directorBeat, char.id);

                let nextState = currentState;
                let nextImpression = currentImpression;

                if (subApi && updateStrength !== 'weak') {
                    setClosingStatus(`正在请求副 API：评估 ${char.name} 的状态...`);
                    nextState = await evaluateCharacterState(
                        subApi,
                        char.name,
                        userName,
                        summary,
                        currentState,
                    );
                    setClosingStatus(`正在请求副 API：更新 ${char.name} 对你的印象...`);
                    nextImpression = await updateImpression(
                        subApi,
                        char.name,
                        userName,
                        summary,
                        currentImpression,
                    );
                } else {
                    setClosingStatus(`正在本地记录 ${char.name} 的弱反应...`);
                    const affectionDelta = updateStrength === 'strong' ? 2 : updateStrength === 'medium' ? 1 : 0;
                    nextState = {
                        ...currentState,
                        affection: Math.min(100, currentState.affection + affectionDelta),
                        mood: updateStrength === 'weak' ? currentState.mood : '心动',
                        innerThought: updateStrength === 'weak'
                            ? currentState.innerThought
                            : currentState.innerThought || '她在镜头前的样子，比想象中更真实。',
                        lastUpdatedScene: summary.slice(0, 50),
                    };
                }

                saveCharacterState(season.seasonId, nextState);
                saveImpression(season.seasonId, nextImpression);
                updatedStates.push(nextState);
                updatedImpressions.push(nextImpression);
            }

            const nextState = updatedStates.find(state => state.characterId === targetCharacter.id) || updatedStates[0] || fallbackTargetState;
            const nextImpression = updatedImpressions.find(item => item.characterId === targetCharacter.id) || updatedImpressions[0] || fallbackTargetImpression;

            setCharState(nextState);
            setImpression(nextImpression);
            setLastSummary(summary);

            // ── Transition to next scene ──
            // Generate next choice and set up new scene
            setClosingStatus('正在生成下一张节目组通知...');
            const nextChoice = resolveNextChoice(season, completedChoiceIds);
            const nextScene = createWaitingScene(season, season.charIds);
            const pauseForChoice = shouldPauseForChoice(nextChoice);

            setScene(nextScene);
            setDirectorBeat(null);
            setDirectorBeatDebug(null);
            setChoice(nextChoice);
            setTranscript([]);  // Clear for new scene
            if (pauseForChoice) {
                setActivePhoneTab('notice');
                setPhoneOpen(true);
            }
            markPhoneTabUnread('notice');
            setNeedsOpening(!pauseForChoice);  // Date-card flow should wait for the user's choice.

            addToast?.('场景已收束，幕后状态已更新', 'success');
        } catch (err) {
            const message = err instanceof Error ? `收场失败：${err.message}` : '场景收束失败';
            setError(message);
            addToast?.(message, 'error');
        } finally {
            setIsClosingScene(false);
            setClosingStatus(null);
        }
    }, [addToast, characters, charState, completedChoiceIds, directorBeat, impression, markPhoneTabUnread, resolveNextChoice, scene, season, targetCharacter, transcript, userName]);

    const currentOptions = choice?.options || [];
    const selectedChatCharacter = chatCharacters.find(char => char.id === selectedChatCharacterId) || targetCharacter;

    const renderNoticePanel = () => (
        <div className="ls-phone-panel">
            <div className="ls-notice-panel">
                <div className="ls-notice-icon">
                    <Sparkle size={18} weight="fill" />
                </div>
                <div className="ls-notice-copy">
                    <span>{choice?.mandatory ? '必须响应' : '可稍后处理'}</span>
                    <p>{choice?.prompt || '节目组暂时没有新通知。'}</p>
                </div>
            </div>

            {currentOptions.length > 0 && (
                <div className="ls-choice-list">
                    {currentOptions.map(option => {
                        const label = getCharacterName(characters, option.id);
                        return (
                            <label key={option.id} className={`ls-choice-option ${selectedChoiceId === option.id ? 'is-selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="loveshow-choice"
                                    value={option.id}
                                    checked={selectedChoiceId === option.id}
                                    onChange={() => setSelectedChoiceId(option.id)}
                                />
                                <span>
                                    <strong>{label === option.id ? option.label : label}</strong>
                                    {option.hint && <em>{option.hint}</em>}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}

            {choice?.freeInput && (
                <textarea
                    className="ls-choice-free-input"
                    value={freeChoiceInput}
                    onChange={(event) => setFreeChoiceInput(event.target.value)}
                    placeholder="写下你的回应..."
                    aria-label="自由回应"
                />
            )}

            <div className="ls-phone-actions">
                {!choice?.mandatory && (
                    <button type="button" className="ls-secondary-action" onClick={() => setPhoneOpen(false)}>
                        稍后
                    </button>
                )}
                {choice && (
                    <button type="button" className="ls-primary-action" onClick={handleChoiceSubmit}>
                        <Check size={17} weight="bold" />
                        {currentOptions.length > 0 || choice?.freeInput ? '提交选择' : '确认参加'}
                    </button>
                )}
            </div>
        </div>
    );

    const renderChatPanel = () => (
        <div className="ls-phone-panel ls-chat-panel">
            <div className="ls-chat-recipient-row" role="tablist" aria-label="私聊对象">
                {chatCharacters.map(char => (
                    <button
                        key={char.id}
                        type="button"
                        className={selectedChatCharacterId === char.id ? 'is-active' : ''}
                        onClick={() => setSelectedChatCharacterId(char.id)}
                    >
                        {char.avatar ? <img src={char.avatar} alt="" /> : <UserCircle size={18} weight="fill" />}
                        <span>{char.name}</span>
                    </button>
                ))}
            </div>

            <div className="ls-chat-thread" ref={chatThreadRef} aria-live="polite">
                {activePhoneMessages.length > 0 ? activePhoneMessages.map(message => (
                    <div key={message.id} className={`ls-phone-message is-${message.sender}`}>
                        <span>{message.content}</span>
                    </div>
                )) : (
                    <div className="ls-phone-empty">
                        <ChatCircleText size={22} weight="fill" />
                        <span>还没有私聊。你可以先发一条。</span>
                    </div>
                )}
                {isPhoneSending && (
                    <div className="ls-phone-message is-character is-typing">
                        <span>{selectedChatCharacter?.name || '嘉宾'} 正在输入...</span>
                    </div>
                )}
            </div>

            <form
                className="ls-phone-compose"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendPhoneMessage();
                }}
            >
                <input
                    value={phoneDraft}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder={`发给 ${selectedChatCharacter?.name || '嘉宾'}`}
                    aria-label="私聊输入"
                    disabled={isPhoneSending}
                />
                <button type="submit" disabled={!phoneDraft.trim() || isPhoneSending} aria-label="发送私聊" title="发送">
                    <PaperPlaneTilt size={18} weight="fill" />
                </button>
            </form>
        </div>
    );

    const renderMissionPanel = () => (
        <div className="ls-phone-panel">
            {missions.length > 0 ? (
                <div className="ls-mission-list">
                    {missions.map((mission: DirectorMission) => (
                        <article key={mission.id} className={`ls-mission-card ${mission.completed ? 'is-completed' : ''}`}>
                            <span>Day {mission.dayNumber}</span>
                            <h3>{mission.description}</h3>
                            <p>奖励：{mission.reward || '等待节目组揭晓'}</p>
                            <button type="button" onClick={() => handleToggleMission(mission.id)}>
                                <Check size={16} weight="bold" />
                                {mission.completed ? '已完成' : '标记完成'}
                            </button>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="ls-phone-empty">
                    <Target size={24} weight="fill" />
                    <span>还没有密令。节目组通常会在合适的节点悄悄塞给你。</span>
                </div>
            )}
        </div>
    );

    const renderCastPanel = () => (
        <div className="ls-phone-panel">
            <div className="ls-cast-card-list">
                {chatCharacters.map(char => {
                    const state = season ? getAllCharacterStates(season.seasonId).find(item => item.characterId === char.id) : null;
                    const charImpression = season ? getImpression(season.seasonId, char.id) : null;
                    return (
                        <article key={char.id} className="ls-cast-card">
                            {char.avatar ? <img src={char.avatar} alt="" /> : <UserCircle size={28} weight="fill" />}
                            <div>
                                <span>已解锁嘉宾</span>
                                <h3>{char.name}</h3>
                                <p>{state ? `${state.mood} · 好感 ${state.affection}/100` : '节目资料正在解锁'}</p>
                                {charImpression?.impression && <em>{charImpression.impression}</em>}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );

    const renderBuzzPanel = () => (
        <div className="ls-phone-panel">
            <div className="ls-buzz-header">
                <div>
                    <span>Day {season?.day || 1}</span>
                    <h3>播出热搜</h3>
                </div>
                <button type="button" onClick={() => void handleGenerateBuzz()} disabled={isGeneratingBuzz}>
                    <Fire size={16} weight="fill" />
                    {isGeneratingBuzz ? '刷新中' : '刷新'}
                </button>
            </div>
            {socialPosts.length > 0 ? (
                <div className="ls-buzz-list">
                    {socialPosts.map(post => (
                        <article key={post.id} className="ls-buzz-card">
                            <span>{post.platform === 'xhs' ? '小红书' : '微博'} · @{post.username}</span>
                            <p>{post.content}</p>
                            {typeof post.likes === 'number' && <em>{post.likes} 人点赞</em>}
                        </article>
                    ))}
                </div>
            ) : (
                <div className="ls-phone-empty">
                    <Fire size={24} weight="fill" />
                    <span>还没有热搜剪辑。点刷新，让节目外的观众开始乱嗑。</span>
                </div>
            )}
        </div>
    );

    const renderActivePhonePanel = () => {
        switch (activePhoneTab) {
            case 'chat':
                return renderChatPanel();
            case 'mission':
                return renderMissionPanel();
            case 'cast':
                return renderCastPanel();
            case 'buzz':
                return renderBuzzPanel();
            case 'notice':
            default:
                return renderNoticePanel();
        }
    };

    if (!targetCharacter) {
        return (
            <div className="ls-app ls-empty-app">
                <div className="ls-empty-panel">
                    <Heart size={34} weight="fill" />
                    <h1>恋综还缺一位嘉宾</h1>
                    <p>先在角色库里准备一个角色，LoveShow Phase 1 会用第一位角色启动单人恋综线。</p>
                    <div className="ls-empty-actions">
                        <button type="button" onClick={() => openApp?.(AppID.Character)} className="ls-primary-action">
                            <UserCircle size={18} weight="bold" />
                            去角色库
                        </button>
                        <button type="button" onClick={closeApp} className="ls-secondary-action">
                            <X size={18} weight="bold" />
                            退出
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ls-app">
            <div className="ls-topbar">
                <button type="button" onClick={closeApp} className="ls-topbar-btn" aria-label="退出恋综" title="退出">
                    <X size={18} weight="bold" />
                </button>
                <div className="ls-brand">
                    <span>LoveShow</span>
                    <strong>恋综</strong>
                </div>
                <div className="ls-status-pill">
                    <Heart size={15} weight="fill" />
                    {focusCharacterState ? `${focusCharacterState.affection}/100` : '--'}
                </div>
            </div>

            {scene && (
                <LoveShowScene
                    scene={scene}
                    characters={characters}
                    turns={transcript}
                    inputValue={input}
                    isSending={isSending}
                    isClosingScene={isClosingScene}
                    closingStatus={closingStatus}
                    error={error}
                    canRetry={pendingRetry}
                    onInputChange={setInput}
                    onSend={handleSend}
                    onRetry={handleRetry}
                    onCompleteScene={handleCompleteScene}
                />
            )}

            <aside className="ls-state-rail" aria-label="LoveShow backstage state">
                <div>
                    <span>镜头焦点</span>
                    <strong>{focusCharacter?.name || targetCharacter.name}</strong>
                </div>
                <div>
                    <span>心情</span>
                    <strong>{focusCharacterState?.mood || '期待'}</strong>
                </div>
                <div>
                    <span>在场</span>
                    <strong>{scene?.characterIds.length || 0}</strong>
                </div>
            </aside>

            {SHOW_DIRECTOR_DEBUG && directorBeatDebugSummary && (
                <aside className="ls-director-debug" aria-label="DirectorBeat debug">
                    <div className="ls-director-debug-header">
                        <span>DirectorBeat</span>
                        <strong>{directorBeatDebugSummary.source}</strong>
                    </div>
                    <dl>
                        <div>
                            <dt>本轮在场</dt>
                            <dd>{directorBeatDebugSummary.present}</dd>
                        </div>
                        <div>
                            <dt>镜头焦点</dt>
                            <dd>{directorBeatDebugSummary.focus}</dd>
                        </div>
                        <div>
                            <dt>发言人</dt>
                            <dd>{directorBeatDebugSummary.speakers}</dd>
                        </div>
                        <div>
                            <dt>反应位</dt>
                            <dd>{directorBeatDebugSummary.reactions}</dd>
                        </div>
                        <div>
                            <dt>结束方式</dt>
                            <dd>{directorBeatDebugSummary.ending}</dd>
                        </div>
                    </dl>
                    {directorBeatDebugSummary.issues.length > 0 && (
                        <p>{directorBeatDebugSummary.issues.slice(0, 3).join('；')}</p>
                    )}
                </aside>
            )}

            <button
                type="button"
                className="ls-phone-fab"
                onClick={handleOpenPhone}
                aria-label="打开小手机"
                title="打开小手机"
            >
                <Phone size={24} weight="fill" />
                {hasAnyUnreadPhone && <span className="ls-phone-dot" />}
            </button>

            {phoneOpen && (
                <div className="ls-phone-layer" aria-label="小手机悬浮层">
                    <section
                        className="ls-phone-drawer"
                        role="dialog"
                        aria-label="小手机"
                        style={{ transform: `translate3d(${phonePosition.x}px, ${phonePosition.y}px, 0)` }}
                    >
                        <div
                            className="ls-phone-drag-zone"
                            onPointerDown={handlePhoneDragStart}
                            title="拖动"
                        >
                            <span className="ls-phone-device-island" aria-hidden="true" />
                        </div>
                        <button
                            type="button"
                            className="ls-phone-side-key"
                            onClick={() => setPhoneOpen(false)}
                            aria-label="关闭小手机"
                            title="收起"
                        />
                        <input
                            ref={phoneWallpaperInputRef}
                            className="ls-phone-wallpaper-input"
                            type="file"
                            accept="image/*"
                            onChange={handlePhoneWallpaperSelect}
                        />
                        <div className="ls-phone-screen">
                            <img className="ls-phone-wallpaper-media" src={phoneWallpaperUrl} alt="" aria-hidden="true" />
                            <div className="ls-phone-wallpaper-tint" aria-hidden="true" />
                            <div className="ls-phone-wallpaper-actions" aria-label="壁纸设置">
                                <button
                                    type="button"
                                    onClick={() => phoneWallpaperInputRef.current?.click()}
                                    aria-label="更换壁纸"
                                    title="更换壁纸"
                                >
                                    <ImageSquare size={15} weight="bold" />
                                </button>
                                {hasCustomPhoneWallpaper && (
                                    <button
                                        type="button"
                                        onClick={() => void handleResetPhoneWallpaper()}
                                        aria-label="恢复默认壁纸"
                                        title="恢复默认壁纸"
                                    >
                                        <ArrowCounterClockwise size={15} weight="bold" />
                                    </button>
                                )}
                            </div>
                            <div className="ls-phone-tabs" role="tablist" aria-label="LoveShow phone tabs">
                                {PHONE_TABS.map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`ls-phone-tab${activePhoneTab === tab.id ? ' is-active' : ''}`}
                                            role="tab"
                                            aria-selected={activePhoneTab === tab.id}
                                            onClick={() => handlePhoneTabSelect(tab.id)}
                                        >
                                            <Icon size={16} weight={activePhoneTab === tab.id ? 'fill' : 'bold'} />
                                            <span>{tab.label}</span>
                                            {phoneUnreadTabs[tab.id] && <i aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {renderActivePhonePanel()}

                            <div className="ls-phone-home-indicator" aria-hidden="true" />
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default LoveShowApp;
