import React, { memo, useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, WarningCircle } from '@phosphor-icons/react';
import type { CharacterProfile } from '../../types';
import {
    fetchAgentLifeProfile,
    generateAgentLifeProfile,
    type AgentApiConfig,
    type AgentLifePatternProfile,
    type AgentLifeProfileState,
} from '../../utils/agentBackendClient';
import { buildLifeProfileContextSnapshot } from '../../utils/lifeProfileContextSnapshot';
import { getSecondaryApiConfig } from '../../utils/runtimeConfig';

interface CharacterLifeProfileCardProps {
    character: CharacterProfile;
    userName?: string;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return '生活档案整理失败';
}

function hasCompleteApiConfig(value: unknown): value is AgentApiConfig {
    if (!value || typeof value !== 'object') return false;
    const config = value as Partial<AgentApiConfig>;
    return Boolean(config.baseUrl?.trim() && config.apiKey?.trim() && config.model?.trim());
}

function pickSecondaryApiConfig(): AgentApiConfig | undefined {
    const config = getSecondaryApiConfig();
    if (!hasCompleteApiConfig(config)) return undefined;
    return {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
    };
}

function formatDate(timestamp?: number): string {
    if (!timestamp) return '';
    try {
        return new Date(timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function stringifyValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join('、');
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).map(stringifyValue).filter(Boolean).join('、');
    }
    return '';
}

function readFirstText(record: Record<string, unknown> | undefined, keys: string[]): string {
    if (!record) return '';
    for (const key of keys) {
        const text = stringifyValue(record[key]).trim();
        if (text) return text;
    }
    return stringifyValue(record).trim();
}

function readList(record: Record<string, unknown> | undefined, key: string): string[] {
    const value = record?.[key];
    if (!Array.isArray(value)) return [];
    return value
        .map(item => stringifyValue(item).trim())
        .filter(Boolean)
        .slice(0, 6);
}

function SummaryChip({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">
            {children}
        </span>
    );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{value}</div>
        </div>
    );
}

function LifeProfileReadyView({ profile }: { profile: AgentLifePatternProfile }) {
    const stableActivities = readList(profile.activityPalette, 'stable');
    const occasionalActivities = readList(profile.activityPalette, 'occasional');
    const lowFrequencyTexture = readList(profile.activityPalette, 'lowFrequencyTexture');
    const genericPlaces = Array.isArray(profile.placeModel?.genericPlaces)
        ? profile.placeModel.genericPlaces.map(String).slice(0, 6)
        : [];
    const specificPlaces = Array.isArray(profile.placeModel?.specificPlaces)
        ? profile.placeModel.specificPlaces.slice(0, 4)
        : [];

    return (
        <div className="space-y-3">
            <div className="rounded-3xl bg-white/80 p-4 ring-1 ring-slate-100">
                <p className="text-sm leading-relaxed text-slate-700">{profile.summary}</p>
            </div>

            <div className="grid grid-cols-1 gap-2">
                <InfoLine label="生活身份" value={readFirstText(profile.lifeIdentity, ['currentRole', 'lifeStage'])} />
                <InfoLine label="周节奏" value={readFirstText(profile.weeklyRhythm, ['workdays', 'anchors'])} />
                <InfoLine label="时间感" value={readFirstText(profile.timeRhythm, ['sleepWake', 'activeWindows'])} />
                <InfoLine label="关系边界" value={readFirstText(profile.relationshipToUser, ['availabilityPattern', 'contactStyle'])} />
            </div>

            {(genericPlaces.length > 0 || specificPlaces.length > 0) && (
                <div className="rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">生活空间</div>
                    <div className="flex flex-wrap gap-1.5">
                        {genericPlaces.map(place => <SummaryChip key={`generic-${place}`}>{place}</SummaryChip>)}
                        {specificPlaces.map(place => (
                            <SummaryChip key={`specific-${place.name}`}>{place.name}</SummaryChip>
                        ))}
                    </div>
                </div>
            )}

            {(stableActivities.length > 0 || occasionalActivities.length > 0 || lowFrequencyTexture.length > 0) && (
                <div className="rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">活动底色</div>
                    <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-500">
                        {stableActivities.length > 0 && <div>稳定：{stableActivities.join('、')}</div>}
                        {occasionalActivities.length > 0 && <div>偶尔：{occasionalActivities.join('、')}</div>}
                        {lowFrequencyTexture.length > 0 && <div>低频纹理：{lowFrequencyTexture.join('、')}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

function LifeProfileDetails({ state }: { state: AgentLifeProfileState }) {
    const profile = state.profile;
    if (!profile) return null;

    return (
        <div className="space-y-2">
            {profile.uncertainties.length > 0 && (
                <details className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-slate-100">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">不确定项</summary>
                    <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-500">
                        {profile.uncertainties.map((item, index) => (
                            <div key={index}>
                                <span className="font-semibold text-slate-600">{stringifyValue(item.topic) || '未确认信息'}：</span>
                                {stringifyValue(item.detail)}
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {profile.evidence.length > 0 && (
                <details className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-slate-100">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">证据</summary>
                    <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-500">
                        {profile.evidence.map((item, index) => (
                            <div key={stringifyValue(item.id) || index} className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-semibold text-slate-600">{stringifyValue(item.supports) || '生活依据'}</div>
                                {stringifyValue(item.quote) && <div className="mt-1 text-slate-400">{stringifyValue(item.quote)}</div>}
                            </div>
                        ))}
                    </div>
                </details>
            )}

            <details className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-slate-100">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500">原文 JSON</summary>
                <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/90 p-3 text-[10px] leading-relaxed text-slate-100">
                    {JSON.stringify(state, null, 2)}
                </pre>
            </details>
        </div>
    );
}

const CharacterLifeProfileCard: React.FC<CharacterLifeProfileCardProps> = memo(({
    character,
    userName,
    addToast,
}) => {
    const [state, setState] = useState<AgentLifeProfileState>({ status: 'missing' });
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setLoadError('');

        fetchAgentLifeProfile(character.id)
            .then((nextState) => {
                if (!cancelled) setState(nextState);
            })
            .catch((error) => {
                if (!cancelled) {
                    setLoadError(getErrorMessage(error));
                    setState({ status: 'missing' });
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [character.id]);

    const handleGenerate = useCallback(async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setLoadError('');

        try {
            const contextSnapshot = await buildLifeProfileContextSnapshot(character, userName);
            const nextState = await generateAgentLifeProfile(
                character.id,
                contextSnapshot as unknown as Record<string, unknown>,
                pickSecondaryApiConfig(),
            );
            setState(nextState);

            if (nextState.status === 'ready') {
                addToast('生活档案已整理好', 'success');
            } else {
                addToast(nextState.errorMessage || '生活档案整理失败', 'error');
            }
        } catch (error) {
            const message = getErrorMessage(error);
            setState({
                status: 'failed',
                updatedAt: Date.now(),
                errorMessage: message,
            });
            addToast(message, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [addToast, character, isGenerating, userName]);

    const updatedAt = formatDate(state.updatedAt);
    const isReady = state.status === 'ready' && state.profile;
    const isFailed = state.status === 'failed';
    const buttonLabel = isGenerating
        ? '整理中...'
        : isReady
            ? '重新整理生活档案'
            : '整理生活档案';

    return (
        <section className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-rose-50/50 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                        角色城市生活
                    </label>
                    <h2 className="mt-1 text-sm font-semibold text-slate-800">生活档案</h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                        长期生活底稿，第一阶段只读，不影响今日计划。
                    </p>
                </div>
                {updatedAt && <span className="shrink-0 text-[10px] text-slate-400">{updatedAt}</span>}
            </div>

            <div className="mt-4 space-y-3">
                {isLoading && (
                    <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-slate-400 ring-1 ring-slate-100">
                        正在读取生活档案...
                    </div>
                )}

                {isGenerating && (
                    <div className="rounded-2xl bg-rose-50 px-4 py-3 text-xs text-rose-500 ring-1 ring-rose-100">
                        正在从人设、世界观、世界书和记忆里整理生活底稿。
                    </div>
                )}

                {!isLoading && loadError && (
                    <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100">
                        <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                        <span>暂时读不到云端档案，仍可以直接重新整理。</span>
                    </div>
                )}

                {!isLoading && !isReady && !isFailed && (
                    <div className="rounded-2xl bg-white/70 px-4 py-4 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-100">
                        还没有整理过。点下面的按钮后，会生成一份可展开验收的角色生活档案。
                    </div>
                )}

                {isFailed && (
                    <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-500 ring-1 ring-red-100">
                        <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                        <span>{state.errorMessage || '生活档案整理失败，可以稍后重试。'}</span>
                    </div>
                )}

                {isReady && <LifeProfileReadyView profile={state.profile!} />}
                {isReady && <LifeProfileDetails state={state} />}
            </div>

            <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
            >
                <ArrowsClockwise size={15} weight="bold" className={isGenerating ? 'animate-spin' : ''} />
                {buttonLabel}
            </button>
        </section>
    );
}, (prev, next) => (
    prev.character.id === next.character.id
    && prev.character.name === next.character.name
    && prev.character.description === next.character.description
    && prev.character.systemPrompt === next.character.systemPrompt
    && prev.character.worldview === next.character.worldview
    && prev.character.cityOverride === next.character.cityOverride
    && prev.character.cityAdcode === next.character.cityAdcode
    && prev.character.isFictionalCity === next.character.isFictionalCity
    && prev.character.cityReferenceReal === next.character.cityReferenceReal
    && prev.character.mountedWorldbooks === next.character.mountedWorldbooks
    && prev.character.refinedMemories === next.character.refinedMemories
    && prev.character.activeMemoryMonths === next.character.activeMemoryMonths
    && prev.userName === next.userName
    && prev.addToast === next.addToast
));

CharacterLifeProfileCard.displayName = 'CharacterLifeProfileCard';

export default CharacterLifeProfileCard;
