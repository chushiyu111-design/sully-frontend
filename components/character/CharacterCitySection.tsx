import React, { memo, startTransition, useDeferredValue, useEffect, useState } from 'react';
import { getCityInputTips, type CityTip } from '../../utils/mapService';

const CITY_SUGGESTION_LIMIT = 6;

type CityFieldKey = 'cityOverride' | 'cityAdcode' | 'isFictionalCity' | 'cityReferenceReal';

interface CharacterCitySectionProps {
    characterId: string;
    cityOverride?: string;
    cityAdcode?: string;
    isFictionalCity?: boolean;
    cityReferenceReal?: string;
    onFieldChange: (field: CityFieldKey, value: string | boolean | undefined) => void;
}

function useCitySuggestions(keyword: string, enabled: boolean, selectedValue?: string) {
    const deferredKeyword = useDeferredValue(keyword);
    const [suggestions, setSuggestions] = useState<CityTip[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const trimmedKeyword = deferredKeyword.trim();
        const trimmedSelectedValue = selectedValue?.trim() || '';

        if (!enabled || !trimmedKeyword || trimmedKeyword === trimmedSelectedValue) {
            startTransition(() => {
                setSuggestions([]);
                setIsOpen(false);
                setIsLoading(false);
            });
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            startTransition(() => setIsLoading(true));

            const nextSuggestions = (await getCityInputTips(trimmedKeyword)).slice(0, CITY_SUGGESTION_LIMIT);
            if (cancelled) return;

            startTransition(() => {
                setSuggestions(nextSuggestions);
                setIsOpen(nextSuggestions.length > 0);
                setIsLoading(false);
            });
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [deferredKeyword, enabled, selectedValue]);

    return {
        suggestions,
        isOpen,
        isLoading,
        setIsOpen,
    };
}

function getCityTipMeta(tip: CityTip): string {
    return [tip.district, tip.adcode].filter(Boolean).join(' · ');
}

const CharacterCitySectionComponent: React.FC<CharacterCitySectionProps> = ({
    characterId,
    cityOverride,
    isFictionalCity,
    cityReferenceReal,
    onFieldChange,
}) => {
    const [cityKeyword, setCityKeyword] = useState(cityOverride || '');
    const [referenceCityKeyword, setReferenceCityKeyword] = useState(cityReferenceReal || '');

    const {
        suggestions: citySuggestions,
        isOpen: isCitySuggestionsOpen,
        isLoading: isCitySuggestionsLoading,
        setIsOpen: setIsCitySuggestionsOpen,
    } = useCitySuggestions(cityKeyword, !isFictionalCity, cityOverride);

    const {
        suggestions: referenceCitySuggestions,
        isOpen: isReferenceCitySuggestionsOpen,
        isLoading: isReferenceCitySuggestionsLoading,
        setIsOpen: setIsReferenceCitySuggestionsOpen,
    } = useCitySuggestions(referenceCityKeyword, Boolean(isFictionalCity), cityReferenceReal);

    useEffect(() => {
        setCityKeyword(cityOverride || '');
        setReferenceCityKeyword(cityReferenceReal || '');
    }, [characterId]);

    useEffect(() => {
        if (!isFictionalCity) return;

        const nextCityValue = cityKeyword.trim() ? cityKeyword : undefined;
        const currentCityValue = cityOverride?.trim() ? cityOverride : undefined;
        if (nextCityValue === currentCityValue) return;

        const timer = window.setTimeout(() => {
            startTransition(() => {
                onFieldChange('cityOverride', nextCityValue);
                if (!nextCityValue) {
                    onFieldChange('cityAdcode', undefined);
                }
            });
        }, 180);

        return () => window.clearTimeout(timer);
    }, [cityKeyword, cityOverride, isFictionalCity, onFieldChange]);

    const handleSelectCityTip = (tip: CityTip) => {
        setCityKeyword(tip.name);
        setIsCitySuggestionsOpen(false);
        onFieldChange('cityOverride', tip.name);
        onFieldChange('cityAdcode', tip.adcode || undefined);
    };

    const handleSelectReferenceCityTip = (tip: CityTip) => {
        setReferenceCityKeyword(tip.name);
        setIsReferenceCitySuggestionsOpen(false);
        onFieldChange('cityReferenceReal', tip.name);
    };

    const handleClearCity = () => {
        setCityKeyword('');
        setIsCitySuggestionsOpen(false);
        onFieldChange('cityOverride', undefined);
        onFieldChange('cityAdcode', undefined);
    };

    const handleClearReferenceCity = () => {
        setReferenceCityKeyword('');
        setIsReferenceCitySuggestionsOpen(false);
        onFieldChange('cityReferenceReal', undefined);
    };

    return (
        <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">📍 角色所在城市</label>
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
                <div className="relative">
                    {isFictionalCity && (
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">城市名称</label>
                    )}
                    <div className="relative">
                        <input
                            value={cityKeyword}
                            onChange={(e) => {
                                const nextValue = e.target.value;
                                setCityKeyword(nextValue);

                                if (!isFictionalCity && !nextValue.trim()) {
                                    setIsCitySuggestionsOpen(false);
                                    onFieldChange('cityOverride', undefined);
                                    onFieldChange('cityAdcode', undefined);
                                }
                            }}
                            onFocus={() => {
                                if (citySuggestions.length > 0) {
                                    setIsCitySuggestionsOpen(true);
                                }
                            }}
                            onBlur={() => {
                                window.setTimeout(() => setIsCitySuggestionsOpen(false), 120);
                            }}
                            className="w-full bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3 pr-10 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                            placeholder={isFictionalCity ? '输入架空城市名...' : '输入城市名搜索...'}
                        />
                        {cityKeyword && (
                            <button
                                type="button"
                                onClick={handleClearCity}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                aria-label="清空城市"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {!isFictionalCity && isCitySuggestionsOpen && citySuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/70">
                            {citySuggestions.map((tip) => (
                                <button
                                    key={`${tip.name}-${tip.adcode || tip.district}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectCityTip(tip);
                                    }}
                                    className="w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="text-sm font-medium text-slate-700">{tip.name}</div>
                                    {getCityTipMeta(tip) && (
                                        <div className="mt-0.5 text-[10px] text-slate-400">{getCityTipMeta(tip)}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    {!isFictionalCity && isCitySuggestionsLoading && (
                        <div className="mt-2 text-[10px] text-slate-400">正在搜索城市...</div>
                    )}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                        type="checkbox"
                        checked={Boolean(isFictionalCity)}
                        onChange={(e) => {
                            onFieldChange('isFictionalCity', e.target.checked ? true : undefined);
                            if (e.target.checked) {
                                onFieldChange('cityAdcode', undefined);
                            }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                    <span>这是一个架空 / 虚构城市</span>
                </label>

                {isFictionalCity && (
                    <div className="space-y-3 rounded-2xl bg-slate-50/80 border border-slate-100 p-4">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">现实参照城市</label>
                            <div className="relative">
                                <input
                                    value={referenceCityKeyword}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        setReferenceCityKeyword(nextValue);
                                        if (!nextValue.trim()) {
                                            handleClearReferenceCity();
                                        }
                                    }}
                                    onFocus={() => {
                                        if (referenceCitySuggestions.length > 0) {
                                            setIsReferenceCitySuggestionsOpen(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        window.setTimeout(() => setIsReferenceCitySuggestionsOpen(false), 120);
                                    }}
                                    className="w-full bg-white rounded-2xl border border-slate-100 px-4 py-3 pr-10 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                                    placeholder="搜索现实参照城市..."
                                />
                                {referenceCityKeyword && (
                                    <button
                                        type="button"
                                        onClick={handleClearReferenceCity}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                        aria-label="清空参照城市"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {isReferenceCitySuggestionsOpen && referenceCitySuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/70">
                                    {referenceCitySuggestions.map((tip) => (
                                        <button
                                            key={`${tip.name}-${tip.adcode || tip.district}`}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectReferenceCityTip(tip);
                                            }}
                                            className="w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="text-sm font-medium text-slate-700">{tip.name}</div>
                                            {getCityTipMeta(tip) && (
                                                <div className="mt-0.5 text-[10px] text-slate-400">{getCityTipMeta(tip)}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {isReferenceCitySuggestionsLoading && (
                                <div className="mt-2 text-[10px] text-slate-400">正在搜索参照城市...</div>
                            )}
                        </div>

                        <p className="text-[11px] leading-relaxed text-slate-400">
                            💡 系统会基于参照城市的真实地理数据，由 AI 转化为符合世界观的内容。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const propsAreEqual = (prev: CharacterCitySectionProps, next: CharacterCitySectionProps) => (
    prev.characterId === next.characterId
    && prev.cityOverride === next.cityOverride
    && prev.cityAdcode === next.cityAdcode
    && prev.isFictionalCity === next.isFictionalCity
    && prev.cityReferenceReal === next.cityReferenceReal
);

const CharacterCitySection = memo(CharacterCitySectionComponent, propsAreEqual);

export default CharacterCitySection;
