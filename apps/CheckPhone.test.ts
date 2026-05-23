import { describe, expect, it } from 'vitest';
import type { PhoneEvidence } from '../types';
import {
    MAX_PHONE_DETAIL_CHARS,
    MAX_PHONE_RECORDS_PER_APP,
    MAX_PHONE_RECORDS_TOTAL,
    normalizeGeneratedPhoneItem,
    normalizeStoredPhoneRecord,
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
            systemMessageId: undefined,
            value: '42',
            shop: '旗舰店'
        });
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
});
