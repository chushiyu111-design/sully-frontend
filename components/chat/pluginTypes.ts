/**
 * Chat Plugin Types — shared type definitions for chat theme plugins.
 * Extracted from ThemeRegistry.ts to break the circular dependency
 * between ThemeRegistry.ts and WeChatTransferCard.tsx.
 */

import type { Message } from '../../types';

/** Shared props for all transfer card plugins */
export interface TransferCardProps {
    message: Message;
    isUser: boolean;
    charName: string;
    selectionMode: boolean;
    onTransferAction?: (msg: Message) => void;
}
