/**
 * Push Subscription Manager
 * 
 * Handles:
 *   1. Registering the push Service Worker
 *   2. Requesting notification permission
 *   3. Subscribing to Web Push via VAPID
 *   4. Sending the subscription to the backend
 *   5. Sending a test push notification to verify end-to-end
 * 
 * Called once on page load (after 3s delay) from OSContext.
 * Idempotent — won't re-subscribe if already subscribed.
 * Includes retry logic for reliability.
 */

import { getBackendUrl, getUserId } from './backendClient';

const API_TOKEN = 'csyos_k7m2x9f4p1w8v3';

// ─── 可视化状态（在设置页面可以查看）───────────────────
let _pushStatus: string = '未初始化';
let _pushEndpoint: string = '';
let _pushError: string = '';

export function getPushDebugInfo(): { status: string; endpoint: string; error: string } {
    return { status: _pushStatus, endpoint: _pushEndpoint, error: _pushError };
}

/**
 * Initialize push notifications.
 * Safe to call multiple times — exits early if already subscribed.
 * Includes retry logic for network failures.
 */
export async function initPushSubscription(): Promise<void> {
    // Feature detection
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        _pushStatus = '❌ 浏览器不支持 Web Push';
        console.log('🔔 [Push] Not supported in this browser');
        return;
    }

    // Skip in Capacitor native environment
    if (typeof (window as any)?.Capacitor?.isNativePlatform === 'function'
        && (window as any).Capacitor.isNativePlatform()) {
        _pushStatus = '⏭️ 原生环境，跳过 Web Push';
        return;
    }

    const backendUrl = getBackendUrl();
    if (!backendUrl) {
        _pushStatus = '❌ 未配置后端地址';
        console.log('🔔 [Push] No backend URL configured, skipping');
        return;
    }

    _pushStatus = '⏳ 正在注册...';

    try {
        // 1. Register Service Worker (idempotent — returns existing registration if already registered)
        const registration = await navigator.serviceWorker.register('/push-sw.js', {
            scope: '/',
        });

        // Wait for SW to be ready
        await navigator.serviceWorker.ready;
        console.log('🔔 [Push] Service Worker registered');
        _pushStatus = '⏳ SW 已注册，检查订阅...';

        // 2. Check for existing subscription first (avoid duplicate registrations)
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            _pushStatus = '✅ 已订阅（同步到后端中...）';
            _pushEndpoint = subscription.endpoint.slice(0, 60) + '...';
            console.log('🔔 [Push] Already subscribed, syncing to backend...');
            // Still sync to backend (in case the backend lost it)
            await syncSubscriptionToBackend(backendUrl, subscription);
            _pushStatus = '✅ 已订阅，推送就绪';
            return;
        }

        // 3. Request notification permission (only if not yet decided)
        if (Notification.permission === 'default') {
            _pushStatus = '⏳ 等待用户授权通知权限...';
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                _pushStatus = '❌ 通知权限被拒绝';
                _pushError = '用户拒绝了通知权限。请在浏览器设置中手动开启。';
                console.log('🔔 [Push] Notification permission denied');
                return;
            }
        } else if (Notification.permission === 'denied') {
            _pushStatus = '❌ 通知权限已被禁止';
            _pushError = '通知权限被禁止。请在浏览器设置 → 网站设置 → 通知中开启。';
            console.log('🔔 [Push] Notification permission previously denied');
            return;
        }

        _pushStatus = '⏳ 权限已获取，正在获取 VAPID 密钥...';

        // 4. Fetch VAPID public key from backend (with retry)
        let vapidPublicKey: string = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const keyResponse = await fetch(`${backendUrl}/api/push/vapid-key`, {
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'X-User-Id': getUserId(),
                    },
                    signal: AbortSignal.timeout(30000), // 30s timeout (longer for slow networks)
                });

                if (!keyResponse.ok) {
                    throw new Error(`HTTP ${keyResponse.status}`);
                }

                const keyData = await keyResponse.json();
                vapidPublicKey = keyData.vapidPublicKey;
                break; // Success
            } catch (err: any) {
                console.warn(`🔔 [Push] VAPID key fetch attempt ${attempt}/3 failed:`, err.message);
                if (attempt === 3) {
                    _pushStatus = '❌ 获取 VAPID 密钥失败（3次重试）';
                    _pushError = `VAPID 密钥获取失败: ${err.message}`;
                    return;
                }
                // Exponential backoff: 2s, 4s
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        if (!vapidPublicKey) {
            _pushStatus = '❌ VAPID 密钥为空';
            _pushError = 'VAPID key empty from server';
            console.warn('🔔 [Push] VAPID key empty');
            return;
        }

        _pushStatus = '⏳ 正在创建推送订阅...';

        // 5. Subscribe to push (with retry)
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
                });
                break; // Success
            } catch (err: any) {
                console.warn(`🔔 [Push] Subscribe attempt ${attempt}/3 failed:`, err.message);
                if (attempt === 3) {
                    _pushStatus = '❌ 推送订阅创建失败';
                    _pushError = `创建推送订阅失败: ${err.message}`;
                    return;
                }
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        if (!subscription) {
            _pushStatus = '❌ 推送订阅为空';
            return;
        }

        _pushEndpoint = subscription.endpoint.slice(0, 60) + '...';
        console.log('🔔 [Push] Subscribed to push notifications');
        _pushStatus = '⏳ 正在同步订阅到后端...';

        // 6. Send subscription to backend (with retry)
        await syncSubscriptionToBackend(backendUrl, subscription);

        _pushStatus = '✅ 推送通知已就绪';
        console.log('🔔 [Push] ✅ Push notification setup complete!');

        // 7. Send a test notification to verify the full pipeline
        try {
            _pushStatus = '⏳ 发送测试通知验证...';
            await sendTestPush(backendUrl);
            _pushStatus = '✅ 推送通知已就绪（测试通知已发送）';
        } catch (err: any) {
            // Test push failure is non-critical
            console.warn('🔔 [Push] Test push failed (non-critical):', err.message);
            _pushStatus = '✅ 推送通知已就绪（测试通知发送失败，但订阅成功）';
        }

    } catch (err: any) {
        _pushStatus = '❌ 初始化失败';
        _pushError = err.message || String(err);
        console.warn('🔔 [Push] Initialization failed:', err.message);
    }
}

/**
 * Force re-subscribe (for troubleshooting).
 * Removes existing subscription and creates a new one.
 */
export async function forceResubscribe(): Promise<void> {
    try {
        const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
        if (reg) {
            const existingSub = await reg.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
                console.log('🔔 [Push] Unsubscribed existing subscription');
            }
        }
    } catch { /* continue */ }

    // Re-run the full init
    await initPushSubscription();
}

/**
 * Send the PushSubscription to the backend for storage.
 * Backend uses ON CONFLICT(endpoint) DO UPDATE, so this is idempotent.
 * Includes retry logic.
 */
async function syncSubscriptionToBackend(
    backendUrl: string,
    subscription: PushSubscription,
): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const resp = await fetch(`${backendUrl}/api/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'X-User-Id': getUserId(),
                },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
                signal: AbortSignal.timeout(30000),
            });

            if (resp.ok) {
                const data = await resp.json();
                console.log(`🔔 [Push] Subscription synced to backend (${data.subscriptionCount || 1} device(s))`);
                return;
            } else {
                throw new Error(`HTTP ${resp.status}`);
            }
        } catch (err: any) {
            console.warn(`🔔 [Push] Backend sync attempt ${attempt}/3 failed:`, err.message);
            if (attempt === 3) {
                _pushError = `后端同步失败: ${err.message}`;
                throw err;
            }
            await new Promise(r => setTimeout(r, 2000 * attempt));
        }
    }
}

/**
 * Send a test push notification to verify the full pipeline.
 */
async function sendTestPush(backendUrl: string): Promise<void> {
    const resp = await fetch(`${backendUrl}/api/push/test`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
            'X-User-Id': getUserId(),
        },
        signal: AbortSignal.timeout(30000),
    });

    if (resp.ok) {
        console.log('🔔 [Push] Test notification sent!');
    } else {
        const text = await resp.text().catch(() => '');
        console.warn('🔔 [Push] Test push failed:', resp.status, text);
    }
}

/**
 * Convert a URL-safe base64 encoded VAPID key to a Uint8Array.
 * Required by PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
