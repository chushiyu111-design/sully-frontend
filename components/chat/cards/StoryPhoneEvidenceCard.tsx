import React from 'react';
import { Message } from '../../../types';
import StoryPhoneScreen, {
    getStoryPhoneAppById,
    type PhoneClue,
    type PhoneClueItem,
    type StoryPhoneAppId,
} from '../../story-phone/StoryPhoneScreen';

function asText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback;
    return String(value);
}

function normalizeItems(value: unknown): PhoneClueItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => ({
            label: asText(item?.label || item?.title || '记录'),
            value: asText(item?.value || item?.content || item?.text),
            detail: item?.detail ? asText(item.detail) : undefined,
        }))
        .filter(item => item.value || item.detail);
}

function toStoryPhoneAppId(value: unknown): StoryPhoneAppId {
    const app = getStoryPhoneAppById(asText(value));
    return app?.id || 'messages';
}

function buildClueFromMessage(message: Message): PhoneClue {
    const meta = message.metadata || {};
    const appId = toStoryPhoneAppId(meta.phonePeekAppId);
    const appDef = getStoryPhoneAppById(appId);
    const appName = asText(meta.phonePeekAppName, appDef?.name || '手机');
    const evidenceText = asText(meta.phonePeekEvidence);
    const insertSummary = asText(meta.phonePeekInsertSummary);
    const items = normalizeItems(meta.phonePeekItems);

    return {
        appId,
        appName,
        title: asText(meta.phonePeekTitle, `${appName}记录`),
        subtitle: asText(meta.phonePeekSubtitle),
        timestamp: asText(meta.phonePeekTimestamp, new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        items: items.length > 0 ? items : [{ label: '线索', value: evidenceText || insertSummary || message.content }],
        evidenceText,
        insertSummary,
    };
}

const StoryPhoneEvidenceCard: React.FC<{ message: Message }> = ({ message }) => {
    const meta = message.metadata || {};
    const clue = buildClueFromMessage(message);

    return (
        <div className="mx-auto w-[82vw] max-w-[18.5rem]">
            <StoryPhoneScreen
                compact
                charName={asText(meta.charName, '角色')}
                charAvatar={asText(meta.charAvatar)}
                wallpaper={asText(meta.phonePeekWallpaper)}
                activeAppId={clue.appId}
                clue={clue}
            />
        </div>
    );
};

export default StoryPhoneEvidenceCard;
