import type { CharacterProfile } from '../types';

const DEFAULT_MAX_BLOCK_LENGTH = 1200;
const DEFAULT_WORLDBOOK_LIMIT = 5;
const DEFAULT_REFINED_MEMORY_LIMIT = 6;

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number = DEFAULT_MAX_BLOCK_LENGTH): string {
    const compact = collapseWhitespace(value);
    if (compact.length <= maxLength) return compact;
    return `${compact.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function buildMountedWorldbooksDigest(
    mountedWorldbooks: CharacterProfile['mountedWorldbooks'],
    options: { maxItems?: number; maxLength?: number } = {},
): string | undefined {
    if (!mountedWorldbooks || mountedWorldbooks.length === 0) return undefined;

    const maxItems = options.maxItems ?? DEFAULT_WORLDBOOK_LIMIT;
    const maxLength = options.maxLength ?? DEFAULT_MAX_BLOCK_LENGTH;

    const digest = mountedWorldbooks
        .slice(0, maxItems)
        .map((book, index) => {
            const title = truncate(book.title || `Worldbook ${index + 1}`, 50);
            const content = truncate(book.content || '', 220);
            const category = book.category ? ` [${truncate(book.category, 24)}]` : '';
            return content ? `${title}${category}: ${content}` : `${title}${category}`;
        })
        .filter(Boolean)
        .join('\n');

    return digest ? truncate(digest, maxLength) : undefined;
}

export function buildCoreMemoryDigest(
    char: Pick<CharacterProfile, 'refinedMemories' | 'activeMemoryMonths'>,
    fallbackTopMemory?: string,
    options: { maxItems?: number; maxLength?: number } = {},
): string | undefined {
    const maxItems = options.maxItems ?? DEFAULT_REFINED_MEMORY_LIMIT;
    const maxLength = options.maxLength ?? DEFAULT_MAX_BLOCK_LENGTH;
    const refinedMemories = char.refinedMemories || {};
    const activeMonths = new Set(char.activeMemoryMonths || []);

    const refinedEntries = Object.entries(refinedMemories)
        .filter(([, summary]) => !!collapseWhitespace(summary || ''))
        .sort(([leftMonth], [rightMonth]) => {
            const leftActive = activeMonths.has(leftMonth) ? 1 : 0;
            const rightActive = activeMonths.has(rightMonth) ? 1 : 0;
            if (leftActive !== rightActive) return rightActive - leftActive;
            return rightMonth.localeCompare(leftMonth);
        })
        .slice(0, maxItems)
        .map(([month, summary]) => `[${month}] ${truncate(summary, 220)}`);

    if (refinedEntries.length > 0) {
        return truncate(refinedEntries.join('\n'), maxLength);
    }

    return fallbackTopMemory ? truncate(fallbackTopMemory, maxLength) : undefined;
}
