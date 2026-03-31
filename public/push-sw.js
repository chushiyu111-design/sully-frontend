/**
 * Push Service Worker — CSY-Sully OS
 * 
 * Handles:
 *   1. Web Push events → Show system notifications (message bombing style)
 *   2. Notification click → postMessage to React page OR open new window
 */

self.addEventListener('push', function(event) {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const charId = data.data?.charId || '';
        const bubbleIndex = data.data?.bubbleIndex || 0;

        const options = {
            body: data.body || '',
            icon: data.icon || '/icons/icon-192.webp',
            badge: data.badge || '/icons/icon-96.webp',
            // 每个气泡用唯一 tag，保证消息轰炸效果（不会被折叠）
            tag: `msg-${charId}-${Date.now()}-${bubbleIndex}`,
            data: { charId },
            vibrate: [200, 100, 200],
            // requireInteraction: false → 自动消失（避免堆积太多）
            requireInteraction: false,
            // 即使 tag 相同也重新展示通知（轰炸效果核心）
            renotify: true,
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'CSY-Sully OS', options)
        );
    } catch (err) {
        // Fallback: payload 不是 JSON
        event.waitUntil(
            self.registration.showNotification('CSY-Sully OS', {
                body: event.data.text(),
                icon: '/icons/icon-192.webp',
            })
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const charId = event.notification.data?.charId || '';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
            // 找到已打开的页面，通过 postMessage 让 React 直接导航（无需刷新）
            if (clients.length > 0) {
                var target = null;
                // 优先找已聚焦的窗口
                for (var i = 0; i < clients.length; i++) {
                    if (clients[i].focused) {
                        target = clients[i];
                        break;
                    }
                }
                // 没有聚焦的就用第一个
                if (!target) target = clients[0];

                target.postMessage({
                    type: 'NOTIFICATION_CLICK',
                    charId: charId,
                });
                return target.focus();
            }

            // 没有任何已打开的页面 → 打开新窗口，URL 参数告知 React 要导航到哪个角色
            if (self.clients.openWindow) {
                return self.clients.openWindow(
                    self.location.origin + '/?notif_charId=' + encodeURIComponent(charId)
                );
            }
        })
    );
});
