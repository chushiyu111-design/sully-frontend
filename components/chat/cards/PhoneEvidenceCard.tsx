import React from 'react';
import { Message } from '../../../types';

// ─── Sub-card imports (modular architecture) ────────────────────
import WeChatSpyCard from './phone/WeChatSpyCard';
import TaobaoOrderCard from './phone/TaobaoOrderCard';
import MeituanTakeoutCard from './phone/MeituanTakeoutCard';
import CallLogCard from './phone/CallLogCard';
import SocialPostSpyCard from './phone/SocialPostSpyCard';
import DefaultAppCard from './phone/DefaultAppCard';

/**
 * PhoneEvidenceCard — Pure Dispatcher / Router
 *
 * Routes `phoneType` to the appropriate sub-card component.
 * Each sub-card lives in its own file under `./phone/` for
 * easy maintenance, independent iteration, and zero cross-contamination.
 *
 * These cards are IMMUTABLE (not affected by chat theme).
 */

interface PhoneEvidenceCardProps {
    message: Message;
}

function asPhoneCardText(value: unknown, fallback = '', maxChars = 1200): string {
    let text = fallback;
    if (value === null || value === undefined) return fallback;

    if (typeof value === 'string') {
        text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        text = String(value);
    } else if (Array.isArray(value)) {
        text = value
            .map(item => asPhoneCardText(item, '', Math.ceil(maxChars / 2)))
            .filter(Boolean)
            .join('; ');
    } else if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const candidate = record.text ?? record.content ?? record.name ?? record.label ?? record.title ?? record.detail ?? record.status ?? record.amount ?? record.value ?? record.shop;
        if (candidate !== undefined && candidate !== value) {
            text = asPhoneCardText(candidate, fallback, maxChars);
        } else {
            try {
                text = JSON.stringify(value);
            } catch {
                text = fallback;
            }
        }
    }

    const normalized = text.trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

const PhoneEvidenceCard: React.FC<PhoneEvidenceCardProps> = ({ message }) => {
    const meta = message.metadata || {};
    const phoneType = asPhoneCardText(meta.phoneType);
    const title = asPhoneCardText(meta.phoneTitle);
    const detail = asPhoneCardText(meta.phoneDetail);
    const value = asPhoneCardText(meta.phoneValue) || undefined;
    const label = asPhoneCardText(meta.phoneLabel, phoneType);
    const charName = asPhoneCardText(meta.charName);
    const charAvatar = asPhoneCardText(meta.charAvatar) || undefined;
    const shop = asPhoneCardText(meta.phoneShop) || undefined;

    switch (phoneType) {
        case 'chat':
            return <WeChatSpyCard title={title} detail={detail} charName={charName} />;
        case 'order':
            return <TaobaoOrderCard title={title} detail={detail} value={value} shop={shop} />;
        case 'delivery':
            return <MeituanTakeoutCard title={title} detail={detail} value={value} shop={shop} />;
        case 'call':
            return <CallLogCard title={title} detail={detail} value={value} />;
        case 'social':
            return <SocialPostSpyCard title={title} detail={detail} charName={charName} charAvatar={charAvatar} />;
        default:
            // Custom apps or unknown types — generic purple card
            return <DefaultAppCard label={label} title={title} detail={detail} value={value} />;
    }
};

export default PhoneEvidenceCard;
