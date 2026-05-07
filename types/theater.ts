/**
 * Theater App Types — 520 约会剧场
 * 导演引擎驱动的沉浸式文游体验
 */

// ── Location ──

export type LocationTag =
    | 'romantic'    // 浪漫场景
    | 'daily'       // 日常场景
    | 'adventure'   // 冒险/刺激
    | 'quiet'       // 安静/私密
    | 'crowded'     // 人多/热闹
    | 'outdoor'     // 户外
    | 'indoor';     // 室内

export interface TheaterLocation {
    id: string;
    name: string;               // "街角咖啡厅"
    nameEn?: string;            // "Corner Café" — 卡片副标题
    description: string;        // 给导演的氛围提示 (100-200字)
    tags: LocationTag[];        // 事件权重偏好
    bgImage?: string;           // 卡片背景图 URL（预设用 /assets/theater/xxx.webp）
    bgGradient?: string;        // 备用 CSS 渐变
    isPreset: boolean;          // 系统预设 vs 用户自建
    visitCount: number;         // 累计访问次数（影响事件概率）
    lastVisitTime?: number;     // 上次访问时间戳
}

// ── Director Events ──

export type EventType =
    | 'ambient'     // 氛围 — 纯场景描写，不需要用户行动
    | 'encounter'   // 偶遇 — 意外发现、遇到人
    | 'romantic'    // 浪漫 — 甜蜜时刻
    | 'callback'    // 回忆杀 — 关联角色记忆
    | 'conflict'    // 冲突 — 小矛盾、误会
    | 'surprise';   // 惊喜 — 完全意想不到的转折

export interface DirectorEvent {
    sceneType: EventType;
    atmosphere: string;          // 场景氛围描写 (给主 API 的上下文)
    event: string;               // 事件核心描述
    tension: number;             // 0.0-1.0 紧张度
    npcHint?: string;            // NPC 提示（可选）
    suggestedBeats: string[];    // 建议发展方向（辅助主 API）
    timestamp?: number;          // 触发时间
}

// ── Pity System ──

export interface PityCounter {
    roundsSinceLastEvent: number;   // 上次事件后经过的对话轮数
    cooldownRemaining: number;      // 冷却期剩余轮数（触发后 2 轮内不再触发）
    totalEventsTriggered: number;   // 本次游玩总事件触发数
}

// ── Time ──

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const TIME_SLOT_LABELS: Record<TimeSlot, { zh: string; icon: string }> = {
    morning:   { zh: '早晨', icon: '🌅' },
    afternoon: { zh: '下午', icon: '☀️' },
    evening:   { zh: '傍晚', icon: '🌆' },
    night:     { zh: '深夜', icon: '🌙' },
};

// ── Session State (serializable) ──

export interface TheaterSessionState {
    sessionId: string;
    charId: string;
    currentLocationId: string;
    timeSlot: TimeSlot;
    locationChangeCount: number;     // 累计换地点次数
    pity: PityCounter;
    eventHistory: DirectorEvent[];   // 本次游玩所有已触发事件
    visitedLocationIds: string[];    // 本次游玩去过的地点
    is520Event: boolean;             // 是否 520 限时模式
    startedAt: number;
    lastActiveAt: number;
}
