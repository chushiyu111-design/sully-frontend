import { describe, expect, it } from 'vitest';
import type { PhoneEvidence } from '../types';
import {
    MAX_PHONE_DETAIL_CHARS,
    MAX_PHONE_CHAT_DETAIL_CHARS,
    MAX_PHONE_RECORDS_PER_APP,
    MAX_PHONE_RECORDS_TOTAL,
    buildPhoneSystemMessageDraft,
    normalizeGeneratedPhoneItem,
    normalizePhoneState,
    normalizeStoredPhoneRecord,
    phoneStateNeedsNormalization,
    prunePhoneRecords
} from './CheckPhone';

describe('CheckPhone phone record normalization', () => {
    it('normalizes nested AI output into render-safe strings', () => {
        const item = normalizeGeneratedPhoneItem({
            title: { name: '楼下便利店' },
            detail: ['矿泉水×1', { content: '饭团×2' }],
            value: 18.5,
            shop: { status: '已完成' }
        });

        expect(item).toEqual({
            title: '楼下便利店',
            detail: '矿泉水×1; 饭团×2',
            value: '18.5',
            shop: '已完成'
        });
    });

    it('normalizes malformed persisted records before rendering', () => {
        const record = normalizeStoredPhoneRecord({
            id: 123,
            type: 'order',
            title: { label: '订单标题' },
            detail: { content: '规格 | 已发货' },
            timestamp: '1710000000000',
            systemMessageId: 'bad-id',
            value: { amount: '42' },
            shop: ['旗舰店']
        } as unknown as PhoneEvidence);

        expect(record).toMatchObject({
            id: '123',
            type: 'order',
            title: '订单标题',
            detail: '规格 | 已发货',
            timestamp: 1710000000000,
            value: '42',
            shop: '旗舰店'
        });
        expect('systemMessageId' in record).toBe(false);
    });

    it('trims overlong generated fields before they are stored', () => {
        const item = normalizeGeneratedPhoneItem({
            title: '一'.repeat(200),
            detail: '内容'.repeat(2000),
            value: '9'.repeat(400)
        });

        expect(item.title.length).toBeLessThanOrEqual(99);
        expect(item.detail.length).toBeLessThanOrEqual(MAX_PHONE_DETAIL_CHARS + 3);
        expect(item.value?.length).toBeLessThanOrEqual(163);
    });

    it('keeps recent phone records within each app storage limit', () => {
        const bankRecords = Array.from({ length: MAX_PHONE_RECORDS_PER_APP + 12 }, (_, index) => ({
            id: `bank-${index}`,
            type: 'bank',
            title: `bank ${index}`,
            detail: `detail ${index}`,
            timestamp: index + 1
        }));

        const pruned = prunePhoneRecords(bankRecords as PhoneEvidence[]);
        const bankPruned = pruned.filter(record => record.type === 'bank');

        expect(bankPruned.length).toBe(MAX_PHONE_RECORDS_PER_APP);
        expect(bankPruned.some(record => record.id === 'bank-0')).toBe(false);
        expect(bankPruned.some(record => record.id === `bank-${MAX_PHONE_RECORDS_PER_APP + 11}`)).toBe(true);
    });

    it('keeps the total phone record count within the mobile-safe cap', () => {
        const manyCustomRecords = Array.from({ length: MAX_PHONE_RECORDS_TOTAL + 20 }, (_, index) => ({
            id: `custom-${index}`,
            type: `custom-${index}`,
            title: `custom ${index}`,
            detail: `detail ${index}`,
            timestamp: 10_000 + index
        }));

        const pruned = prunePhoneRecords(manyCustomRecords as PhoneEvidence[]);

        expect(pruned.length).toBeLessThanOrEqual(MAX_PHONE_RECORDS_TOTAL);
        expect(pruned.some(record => record.id === 'custom-0')).toBe(false);
        expect(pruned.some(record => record.id === `custom-${MAX_PHONE_RECORDS_TOTAL + 19}`)).toBe(true);
    });

    it('normalizes legacy phone state before it is mounted into the phone app', () => {
        const records = Array.from({ length: MAX_PHONE_RECORDS_PER_APP + 2 }, (_, index) => ({
            id: `chat-${index}`,
            type: 'chat',
            title: index === 0 ? ({ label: '旧联系人' } as unknown as string) : `联系人 ${index}`,
            detail: '长内容'.repeat(2000),
            timestamp: index + 1,
            ...(index === 10 ? { largeLegacyPayload: { nested: '不会被继续带入手机记录' } } : {})
        }));

        const phoneState = { records: records as PhoneEvidence[], customApps: [] };
        const normalized = normalizePhoneState(phoneState);

        expect(phoneStateNeedsNormalization(phoneState, normalized)).toBe(true);
        expect(normalized.records.length).toBe(MAX_PHONE_RECORDS_PER_APP);
        expect(normalized.records[0].title).toBe('联系人 2');
        expect(normalized.records[0].detail.length).toBeLessThanOrEqual(MAX_PHONE_CHAT_DETAIL_CHARS + 3);
        expect('largeLegacyPayload' in (normalized.records.find(record => record.id === 'chat-10') as unknown as Record<string, unknown>)).toBe(false);
    });

    it('keeps chat timeline phone evidence detailed without exceeding record safety limits', () => {
        const longDetail = '招牌奶茶×1; '.repeat(500);
        const draft = buildPhoneSystemMessageDraft({
            type: 'delivery',
            charName: 'Sully',
            charAvatar: 'avatar.png',
            logPrefix: '外卖APP',
            title: '深夜茶餐厅',
            detail: longDetail,
            value: '¥42.00',
            shop: '已完成'
        });

        expect(draft.content).toContain('招牌奶茶');
        expect(String(draft.metadata.phoneDetail).length).toBeLessThanOrEqual(MAX_PHONE_DETAIL_CHARS + 3);
        expect(draft.metadata.phoneTitle).toBe('深夜茶餐厅');
        expect(draft.metadata.phoneValue).toBe('¥42.00');
    });
});
