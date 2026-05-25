import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '../../../types';
import PhoneEvidenceCard from './PhoneEvidenceCard';

function makeMessage(metadata: Message['metadata']): Message {
    return {
        id: 1,
        charId: 'char-1',
        role: 'system',
        type: 'text',
        content: 'phone evidence',
        timestamp: Date.now(),
        metadata,
    };
}

describe('PhoneEvidenceCard', () => {
    it('renders legacy non-string metadata without throwing', () => {
        render(
            <PhoneEvidenceCard
                message={makeMessage({
                    source: 'phone',
                    phoneType: 'delivery',
                    phoneLabel: { label: '外卖APP' },
                    phoneTitle: { name: '深夜茶餐厅' },
                    phoneDetail: ['招牌奶茶×1', { content: '菠萝包×2' }],
                    phoneValue: { amount: '42' },
                    phoneShop: { status: '已完成' },
                    charName: { name: 'Sully' },
                })}
            />,
        );

        expect(screen.getByText('深夜茶餐厅')).toBeInTheDocument();
        expect(screen.getByText(/招牌奶茶/)).toBeInTheDocument();
        expect(screen.getByText(/42/)).toBeInTheDocument();
    });
});
