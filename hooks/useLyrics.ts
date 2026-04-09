import { useEffect, useMemo, useRef, useState } from 'react';
import type { LyricLine } from '../types/music';
import { findCurrentLyricIndex } from '../utils/parseLrc';
import {
    getDistinctLyricTranslation,
    getPlaybackLyricsResource,
} from '../utils/playbackLyricsRuntime';

interface UseLyricsOptions {
    /** 歌曲 ID，为 0 或 undefined 时不获取 */
    songId: number | undefined;
    /** 当前播放时间（秒） */
    currentTime: number;
    /** 是否启用歌词（关闭时跳过获取） */
    enabled?: boolean;
}

interface UseLyricsResult {
    /** 解析后的所有歌词行 */
    lines: LyricLine[];
    /** 当前高亮行索引，-1 表示尚无匹配 */
    currentIndex: number;
    /** 当前行歌词文本 */
    currentText: string;
    /** 当前行翻译（如有） */
    currentTranslation: string;
    /** 是否正在加载歌词 */
    isLoading: boolean;
    /** 加载错误 */
    error: string | null;
}

export function useLyrics({
    songId,
    currentTime,
    enabled = true,
}: UseLyricsOptions): UseLyricsResult {
    const [lines, setLines] = useState<LyricLine[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!songId || songId <= 0 || !enabled) {
            requestIdRef.current += 1;
            setLines([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        setIsLoading(true);
        setError(null);

        getPlaybackLyricsResource(songId)
            .then((result) => {
                if (requestId !== requestIdRef.current) return;

                setLines(result.lines);
                setError(result.error);
            })
            .catch((err: unknown) => {
                if (requestId !== requestIdRef.current) return;

                setError(err instanceof Error ? err.message : '歌词加载失败');
                setLines([]);
            })
            .finally(() => {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            });
    }, [enabled, songId]);

    const currentIndex = useMemo(
        () => findCurrentLyricIndex(lines, currentTime),
        [currentTime, lines],
    );

    const currentLine = currentIndex >= 0 ? lines[currentIndex] : null;

    return {
        lines,
        currentIndex,
        currentText: currentLine?.text ?? '',
        currentTranslation: getDistinctLyricTranslation(
            currentLine?.text ?? '',
            currentLine?.translation ?? '',
        ),
        isLoading,
        error,
    };
}
