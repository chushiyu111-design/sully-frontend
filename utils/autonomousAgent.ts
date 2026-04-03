/**
 * Autonomous Agent — Backend-Driven Architecture
 * 
 * v3: Removed SSE long-connection. Message delivery now via:
 *   1. Web Push (primary — backend sends push when message is generated)
 *   2. visibilitychange (page returns to foreground → immediate fetch)
 *   3. 5-minute fallback poll (compensates for Push failures in China)
 * 
 * The Cron / LLM decision / LifeStream logic is entirely backend-side.
 * Frontend only:
 *   1. Registers the agent on backend (POST /api/agent/start)
 *   2. Pushes context snapshots every 5 min
 *   3. Fetches pending messages on visibility restore / push event / 5-min tick
 *   4. Notifies backend when user replies
 */

import { DB } from './db';
import { CharacterProfile } from '../types';
import { getBackendUrl, getUserId } from './backendClient';

// ═══════════════════════════════════════════════════════════════
//  Types (shared with backend)
// ═══════════════════════════════════════════════════════════════

export interface SecondaryApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface LLMDecision {
    action: 'none' | 'send' | 'call' | 'think';
    topic?: string;
    reason?: string;
    content?: string;
}

export interface AgentConfig {
    minIntervalMin: number;
    maxIntervalMin: number;
    cooldownHours: number;
    maxDailyActions: number;
    maxConsecutiveIgnored: number;
    baseProb: number;
    notificationsEnabled: boolean;
}

const AGENT_CONFIG_DEFAULTS: AgentConfig = {
    minIntervalMin: 15,
    maxIntervalMin: 40,
    cooldownHours: 2,
    maxDailyActions: 5,
    maxConsecutiveIgnored: 2,
    baseProb: 0.15,
    notificationsEnabled: true,
};

const AGENT_CONFIG_STORAGE_KEY = 'agent_config';

/** 读取用户配置，缺失项使用默认值 */
export function getAgentConfig(): AgentConfig {
    try {
        const raw = localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...AGENT_CONFIG_DEFAULTS, ...parsed };
        }
    } catch { /* ignore */ }
    return { ...AGENT_CONFIG_DEFAULTS };
}

/** 保存用户配置 */
export function saveAgentConfig(config: Partial<AgentConfig>): void {
    try {
        const current = getAgentConfig();
        const merged = { ...current, ...config };
        localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
//  Backend API Client
// ═══════════════════════════════════════════════════════════════

function getHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer csyos_k7m2x9f4p1w8v3`,
        'X-User-Id': getUserId(),
    };
}

/**
 * 按路由区分超时时间：
 *   /api/agent/start  → 45s（有多次 D1 写入 + 大请求体）
 *   其它              → 15s
 */
function getTimeoutMs(path: string): number {
    if (path.startsWith('/api/agent/start')) return 45000;
    return 15000;
}

async function agentFetch(path: string, options: RequestInit = {}): Promise<any> {
    const baseUrl = getBackendUrl();
    if (!baseUrl) throw new Error('Backend URL not configured');

    const resp = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) },
        signal: AbortSignal.timeout(getTimeoutMs(path)),
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Agent API ${resp.status}: ${text.slice(0, 200)}`);
    }

    return resp.json();
}

/**
 * 带重试的 agentFetch：最多重试 maxRetries 次，失败间隔指数增长。
 * 专用于重要的写入操作（如 start）。
 */
async function agentFetchWithRetry(
    path: string,
    options: RequestInit = {},
    maxRetries = 2,
): Promise<any> {
    let lastErr: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await agentFetch(path, options);
        } catch (err: any) {
            lastErr = err;
            if (attempt < maxRetries) {
                const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
                console.warn(`🤖 [Agent] ${path} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastErr;
}

// ═══════════════════════════════════════════════════════════════
//  Context Snapshot Builder
// ═══════════════════════════════════════════════════════════════

async function buildContextSnapshot(charId: string, char: CharacterProfile) {
    const now = Date.now();

    // 获取最近消息
    const recentMsgs = await DB.getRecentMessagesByCharId(charId, 20);

    // 计算沉默时长
    let lastUserMsgAt = 0;
    let lastAIMsgAt = 0;
    let lastAIMsgWasAutonomous = false;

    for (let i = recentMsgs.length - 1; i >= 0; i--) {
        const m = recentMsgs[i];
        if (m.role === 'user' && !lastUserMsgAt) lastUserMsgAt = m.timestamp;
        if (m.role === 'assistant' && !lastAIMsgAt) {
            lastAIMsgAt = m.timestamp;
            lastAIMsgWasAutonomous = m.metadata?.source === 'autonomous';
        }
    }

    // 获取用户名
    let userName = '用户';
    try {
        const userProfile = await DB.getUserProfile();
        if (userProfile?.name) userName = userProfile.name;
    } catch { /* ignore */ }

    // 获取可用表情包名称
    let emojiNames: string[] = [];
    try {
        const emojis = await DB.getEmojis();
        emojiNames = emojis.map(e => e.name).slice(0, 30); // Limit to 30 names
    } catch { /* ignore */ }

    // 荷尔蒙状态
    const moodState = (char.moodState as unknown as Record<string, number>) || null;

    // 人设摘要（截取前 2000 字）
    const charSystemPrompt = (char.systemPrompt || '').slice(0, 2000);
    const charPersonality = (char.description || '').slice(0, 300);

    // 精选高权重记忆
    let topMemory: string | undefined;
    try {
        const headers = await DB.getVectorMemoryHeaders(charId);
        if (headers && headers.length > 0) {
            const active = headers.filter(h => !h.deprecated);
            if (active.length > 0) {
                // 取 importance 最高的
                active.sort((a, b) => (b.importance || 5) - (a.importance || 5));
                const top = active[0];
                topMemory = `${top.title || ''}：${(top.content || '').slice(0, 80)}`;
            }
        }
    } catch { /* ignore */ }

    return {
        charId,
        charName: char.name,
        charSystemPrompt,
        charPersonality,
        userName,
        recentMessages: recentMsgs.map(m => ({
            role: m.role,
            content: m.content.slice(0, 500), // Limit per message
            timestamp: m.timestamp,
        })),
        moodState,
        lastUserMsgAt,
        lastAIMsgAt,
        lastAIMsgWasAutonomous,
        emojiNames,
        topMemory,
        updatedAt: now,
    };
}

// ═══════════════════════════════════════════════════════════════
//  BackendAgentManager — Frontend Orchestrator (Push-driven)
// ═══════════════════════════════════════════════════════════════

// Module-level singleton to prevent React StrictMode double-connect
let _instance: BackendAgentManager | null = null;

export class BackendAgentManager {
    private contextTimer: ReturnType<typeof setInterval> | null = null;
    private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    private stopped = false;
    private charId: string = '';
    private charRef: CharacterProfile | null = null;
    private isFetching = false; // deduplicate concurrent fetches

    // Bound event handlers (stored for cleanup)
    private boundVisibilityHandler: (() => void) | null = null;
    private boundSwMessageHandler: ((e: MessageEvent) => void) | null = null;

    /**
     * 启动 Agent:
     *   1. 推送完整上下文到后端
     *   2. 调用 /api/agent/start
     *   3. 监听 visibilitychange (回前台时拉消息)
     *   4. 监听 Service Worker PUSH_RECEIVED (Web Push 到达时立即拉消息)
     *   5. 5 分钟兜底轮询 (补偿 Push 在国内失败的场景)
     *   6. 启动上下文推送 (5min)
     *
     * @returns cleanup 函数
     */
    start(
        charId: string,
        char: CharacterProfile,
        secondaryApi: SecondaryApiConfig,
    ): () => void {
        // Singleton guard: if another instance is running for the same char, stop it
        if (_instance && _instance !== this) {
            _instance.stop();
        }
        _instance = this;

        this.stopped = false;
        this.charId = charId;
        this.charRef = char;

        const isDebug = localStorage.getItem('autonomous_debug') === 'true';

        // Async initialization
        (async () => {
            try {
                // 1. Build context snapshot
                const contextSnapshot = await buildContextSnapshot(charId, char);

                // 2. Get primary API config
                let mainApiConfig: SecondaryApiConfig | undefined;
                try {
                    const raw = localStorage.getItem('os_api_config');
                    if (raw) {
                        const cfg = JSON.parse(raw);
                        if (cfg.apiKey && cfg.baseUrl && cfg.model) {
                            mainApiConfig = {
                                baseUrl: cfg.baseUrl.replace(/\/+$/, ''),
                                apiKey: cfg.apiKey,
                                model: cfg.model,
                            };
                        }
                    }
                } catch { /* ignore */ }

                if (!mainApiConfig) {
                    console.warn('🤖 [Agent] No primary API config, agent will not generate messages');
                }

                // 3. Start agent on backend（最多重试 2 次）
                await agentFetchWithRetry('/api/agent/start', {
                    method: 'POST',
                    body: JSON.stringify({
                        charId,
                        apiConfig: secondaryApi,
                        mainApiConfig,
                        contextSnapshot,
                        agentConfig: getAgentConfig(),
                    }),
                });

                console.log(`🤖 [Agent] Backend agent started for ${char.name}`);
                if (this.stopped) return;

                // 4. Immediately fetch any pending messages (catch-up on startup)
                this.fetchAndDeliverMessages();

                // 5. visibilitychange → fetch when page returns to foreground
                this.boundVisibilityHandler = () => {
                    if (this.stopped || document.hidden) return;
                    if (isDebug) console.log('🤖 [Agent] Page visible → fetching pending messages');
                    this.fetchAndDeliverMessages();
                };
                document.addEventListener('visibilitychange', this.boundVisibilityHandler);

                // 6. Service Worker PUSH_RECEIVED → fetch immediately
                if (navigator.serviceWorker) {
                    this.boundSwMessageHandler = (event: MessageEvent) => {
                        if (this.stopped) return;
                        if (event.data?.type === 'PUSH_RECEIVED') {
                            if (isDebug) console.log('🤖 [Agent] PUSH_RECEIVED → fetching pending messages');
                            this.fetchAndDeliverMessages();
                        }
                    };
                    navigator.serviceWorker.addEventListener('message', this.boundSwMessageHandler);
                }

                // 7. 5-minute fallback poll (compensates when Web Push fails, e.g. mainland China)
                this.fallbackPollTimer = setInterval(() => {
                    if (this.stopped || document.hidden) return;
                    if (isDebug) console.log('🤖 [Agent] Fallback poll tick');
                    this.fetchAndDeliverMessages();
                }, 5 * 60 * 1000);

                // 8. Push context updates every 5 minutes
                this.contextTimer = setInterval(() => {
                    if (this.stopped) return;
                    this.pushContext().catch(err => {
                        if (isDebug) console.warn('🤖 [Agent] Context push error:', err.message);
                    });
                }, 5 * 60 * 1000);

            } catch (err: any) {
                console.error('🤖 [Agent] Failed to start backend agent:', err.message);
            }
        })();

        return () => this.stop();
    }

    stop(): void {
        this.stopped = true;
        _instance = null;

        // Remove event listeners
        if (this.boundVisibilityHandler) {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
            this.boundVisibilityHandler = null;
        }
        if (this.boundSwMessageHandler && navigator.serviceWorker) {
            navigator.serviceWorker.removeEventListener('message', this.boundSwMessageHandler);
            this.boundSwMessageHandler = null;
        }

        // Clear timers
        if (this.fallbackPollTimer) { clearInterval(this.fallbackPollTimer); this.fallbackPollTimer = null; }
        if (this.contextTimer) { clearInterval(this.contextTimer); this.contextTimer = null; }

        // Stop agent on backend
        // 用 sendBeacon 代替 fetch：页面卸载时浏览器不会砍掉 sendBeacon 请求
        if (this.charId) {
            const baseUrl = getBackendUrl();
            if (baseUrl && navigator.sendBeacon) {
                const blob = new Blob(
                    [JSON.stringify({ charId: this.charId })],
                    { type: 'application/json' },
                );
                // sendBeacon 无法带自定义 Header，用 query 参数传 userId 和 token
                const userId = getUserId();
                const url = `${baseUrl}/api/agent/stop?_token=csyos_k7m2x9f4p1w8v3&_userId=${encodeURIComponent(userId)}`;
                const sent = navigator.sendBeacon(url, blob);
                if (!sent) {
                    // sendBeacon 队列满时回退到 fetch
                    agentFetch('/api/agent/stop', {
                        method: 'POST',
                        body: JSON.stringify({ charId: this.charId }),
                    }).catch(() => {});
                }
            } else {
                // 不支持 sendBeacon 时回退
                agentFetch('/api/agent/stop', {
                    method: 'POST',
                    body: JSON.stringify({ charId: this.charId }),
                }).catch(() => {});
            }
        }

        console.log('🤖 [Agent] Stopped');
    }

    /**
     * Fetch pending messages from backend and deliver to IndexedDB.
     * Deduplicated: concurrent calls are collapsed into one request.
     */
    async fetchAndDeliverMessages(): Promise<void> {
        if (!this.charId || this.isFetching) return;
        this.isFetching = true;

        const isDebug = localStorage.getItem('autonomous_debug') === 'true';

        try {
            const data = await agentFetch(`/api/agent/messages?charId=${this.charId}`);
            const messages = data.messages || [];

            if (messages.length === 0) return;

            if (isDebug) {
                console.log(`🤖 [Agent] Fetched ${messages.length} pending message(s)`);
            }

            const now = Date.now();
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const metadata = msg.metadata ? JSON.parse(msg.metadata) : {};

                await DB.saveScheduledMessage({
                    id: `backend-${msg.id}-${i}`,
                    charId: this.charId,
                    content: msg.content,
                    dueAt: now + i * 3000,
                    createdAt: msg.created_at || now,
                    metadata: {
                        source: 'autonomous',
                        reason: metadata.reason,
                        fromBackend: true,
                    },
                });
            }

            if (isDebug) {
                console.log(`🤖 [Agent] Saved ${messages.length} backend message(s) to scheduled queue`);
            }

        } catch (err: any) {
            if (localStorage.getItem('autonomous_debug') === 'true') {
                console.warn('🤖 [Agent] Fetch failed:', err.message);
            }
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Push fresh context snapshot to backend.
     */
    async pushContext(): Promise<void> {
        if (!this.charId || !this.charRef) return;

        try {
            let freshChar = this.charRef;
            try {
                const allChars = await DB.getAllCharacters();
                const found = allChars.find(c => c.id === this.charId);
                if (found) {
                    freshChar = found;
                    this.charRef = found;
                }
            } catch { /* use stale */ }

            const ctx = await buildContextSnapshot(this.charId, freshChar);
            await agentFetch('/api/agent/context', {
                method: 'POST',
                body: JSON.stringify(ctx),
            });

            if (localStorage.getItem('autonomous_debug') === 'true') {
                console.log('🤖 [Agent] Context pushed to backend');

                // LifeStream 调试：拉取最新片段并打印
                try {
                    const lsData = await agentFetch(`/api/agent/lifestream?charId=${this.charId}`);
                    if (lsData.fragments && lsData.fragments.length > 0) {
                        console.log(`🌊 [LifeStream] ${lsData.fragments.length} fragment(s) today:`);
                        for (const f of lsData.fragments.slice(-5)) {
                            console.log(`  ${f.time_label} — ${f.fragment}`);
                        }
                    } else {
                        console.log(`🌊 [LifeStream] no fragments yet`);
                    }
                } catch (e: any) {
                    console.log(`🌊 [LifeStream] fetch error: ${e.message}`);
                }
            }
        } catch (err: any) {
            if (localStorage.getItem('autonomous_debug') === 'true') {
                console.warn('🤖 [Agent] Context push failed:', err.message);
            }
        }
    }

    /**
     * Notify backend that user sent a message → reset consecutiveIgnored.
     */
    static async notifyUserReplied(charId: string): Promise<void> {
        try {
            await agentFetch('/api/agent/user-replied', {
                method: 'POST',
                body: JSON.stringify({ charId }),
            });
        } catch { /* silent */ }
    }
}
