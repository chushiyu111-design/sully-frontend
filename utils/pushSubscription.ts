/**
 * Push Subscription Manager
 * 
 * Handles:
 *   1. Registering the push Service Worker
 *   2. Requesting notification permission
 *   3. Subscribing to Web Push via VAPID
 *   4. Sending the subscription to the backend
 * 
 * Called once on page load (after 3s delay) from OSContext.
 * Idempotent — won't re-subscribe if already subscribed.
 */

import { getBackendUrl, getUserId } from './backendClient';

const API_TOKEN = 'change-me-to-a-random-string';

/**
 * Initialize push notifications.
 * Safe to call multiple times — exits early if already subscribed.
 */
export async function initPushSubscription(): Promise<void> {
    // Feature detection
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('🔔 [Push] Not supported in this browser');
        return;
    }

    const backendUrl = getBackendUrl();
    if (!backendUrl) {
        console.log('🔔 [Push] No backend URL configured, skipping');
        return;
    }

    try {
        // 1. Register Service Worker (idempotent — returns existing registration if already registered)
        const registration = await navigator.serviceWorker.register('/push-sw.js', {
            scope: '/',
        });

        // Wait for SW to be ready
        await navigator.serviceWorker.ready;
        console.log('🔔 [Push] Service Worker registered');

        // 2. Check for existing subscription first (avoid duplicate registrations)
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            console.log('🔔 [Push] Already subscribed, syncing to backend...');
            // Still sync to backend (in case the backend lost it)
            await syncSubscriptionToBackend(backendUrl, subscription);
            return;
        }

        // 3. Request notification permission (only if not yet decided)
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('🔔 [Push] Notification permission denied');
                return;
            }
        } else if (Notification.permission === 'denied') {
            console.log('🔔 [Push] Notification permission previously denied');
            return;
        }

        // 4. Fetch VAPID public key from backend
        const keyResponse = await fetch(`${backendUrl}/api/push/vapid-key`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'X-User-Id': getUserId(),
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!keyResponse.ok) {
            console.warn('🔔 [Push] Failed to get VAPID key:', keyResponse.status);
            return;
        }

        const { vapidPublicKey } = await keyResponse.json();
        if (!vapidPublicKey) {
            console.warn('🔔 [Push] VAPID key empty');
            return;
        }

        // 5. Subscribe to push
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });

        console.log('🔔 [Push] Subscribed to push notifications');

        // 6. Send subscription to backend
        await syncSubscriptionToBackend(backendUrl, subscription);

    } catch (err: any) {
        console.warn('🔔 [Push] Initialization failed:', err.message);
    }
}

/**
 * Send the PushSubscription to the backend for storage.
 * Backend uses ON CONFLICT(endpoint) DO UPDATE, so this is idempotent.
 */
async function syncSubscriptionToBackend(
    backendUrl: string,
    subscription: PushSubscription,
): Promise<void> {
    try {
        const resp = await fetch(`${backendUrl}/api/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`,
                'X-User-Id': getUserId(),
            },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
            signal: AbortSignal.timeout(10000),
        });

        if (resp.ok) {
            const data = await resp.json();
            console.log(`🔔 [Push] Subscription synced to backend (${data.subscriptionCount || 1} device(s))`);
        } else {
            console.warn('🔔 [Push] Backend sync failed:', resp.status);
        }
    } catch (err: any) {
        console.warn('🔔 [Push] Backend sync error:', err.message);
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
