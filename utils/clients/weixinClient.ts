import { buildBackendUrl, buildHeaders, readBackendPayload } from './backendCore';

export type WeixinBindingStatus = 'active' | 'disconnected' | 'login_required' | 'disabled';
export type WeixinQrStatus = 'wait' | 'scaned' | 'confirmed' | 'expired';

export interface WeixinBinding {
    id: number;
    userId: string;
    charId: string;
    weixinBotName: string | null;
    bridgeSessionId: string | null;
    status: WeixinBindingStatus;
    createdAt: number;
    updatedAt: number;
}

export interface WeixinBindingsResponse {
    bindings: WeixinBinding[];
}

export interface WeixinQrResponse {
    qrcode: string;
    qrcodeImgUrl: string;
}

export interface WeixinQrStatusResponse {
    status: WeixinQrStatus;
}

function getRequiredBackendUrl(path: string, query?: Record<string, string>): string {
    const url = buildBackendUrl(path, query);
    if (!url || url === path) {
        throw new Error('当前没有可用的测试后端地址');
    }
    return url;
}

async function requestWeixin<T>(
    path: string,
    init: RequestInit = {},
    query?: Record<string, string>,
): Promise<T> {
    const response = await fetch(getRequiredBackendUrl(path, query), {
        ...init,
        headers: {
            ...buildHeaders({ contentType: init.body === undefined ? false : 'application/json' }),
            ...init.headers,
        },
    });

    const { detail, payload } = await readBackendPayload(response);
    if (!response.ok) {
        throw new Error(detail || `微信接口请求失败 (HTTP ${response.status})`);
    }

    return (payload || {}) as T;
}

export async function listWeixinBindings(): Promise<WeixinBinding[]> {
    const payload = await requestWeixin<WeixinBindingsResponse>('/api/weixin/bindings');
    return Array.isArray(payload.bindings) ? payload.bindings : [];
}

export async function generateWeixinQr(charId: string, charName: string): Promise<WeixinQrResponse> {
    return requestWeixin<WeixinQrResponse>('/api/weixin/qr', {
        method: 'POST',
        body: JSON.stringify({ charId, charName }),
    });
}

export async function checkWeixinQrStatus(qrcode: string): Promise<WeixinQrStatusResponse> {
    return requestWeixin<WeixinQrStatusResponse>(
        '/api/weixin/qr/status',
        {},
        { qrcode },
    );
}
