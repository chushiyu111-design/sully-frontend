/**
 * TrendsTab — Weight tracking + health summaries (weekly/monthly reports)
 */
import React, { useEffect, useState } from 'react';
import { useHalfSugar, formatSummaryStatValue } from '../HalfSugarContext';
import { BottomSheetModal } from '../HalfSugarTrackingUI';
import { formatDurationMinutes, formatWeekKeyAsRange, getCurrentWeekRange, getCurrentMonthKey, sortWeightRecordsByLatest, type WeightTimeOfDay } from '../types';

/** Monochrome inline SVG icon */
const Icon: React.FC<{ d: string; size?: number }> = ({ d, size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={size} height={size} style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

const ICON_SCALE = 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97ZM5.25 4.97l-2.62 10.726c-.122.499.106 1.028.589 1.202a5.989 5.989 0 002.031.352 5.989 5.989 0 002.031-.352c.483-.174.711-.703.59-1.202L5.25 4.971Z';
const ICON_CHART = 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125Z';
const ICON_SUN = 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z';
const ICON_MOON = 'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998Z';

const TrendsTab: React.FC = () => {
    const {
        weightRecords, latestWeight, latestBmi, weightDelta, todayDate,
        handleSaveWeight, handleDeleteWeight,
        summaries, isGeneratingSummary, isSummaryListLoading,
        handleGenerateWeeklySummary, handleGenerateMonthlySummary, handleDeleteSummary, handleOpenSummaries,
    } = useHalfSugar();

    const [weightModalOpen, setWeightModalOpen] = useState(false);
    const [weightTimeOfDay, setWeightTimeOfDay] = useState<WeightTimeOfDay>('morning');
    const [weightValue, setWeightValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Load all summaries on mount
    useEffect(() => { void handleOpenSummaries(); }, [handleOpenSummaries]);

    const openWeightModal = (tod: WeightTimeOfDay) => {
        const existing = weightRecords.find((r) => r.date === todayDate && r.timeOfDay === tod);
        setWeightTimeOfDay(tod);
        setWeightValue(existing ? String(existing.weight) : '');
        setWeightModalOpen(true);
    };

    const selectedWeightRecord = weightRecords.find((r) => r.date === todayDate && r.timeOfDay === weightTimeOfDay);

    const handleSave = async () => {
        setIsSaving(true);
        const ok = await handleSaveWeight(weightTimeOfDay, weightValue);
        setIsSaving(false);
        if (ok) setWeightModalOpen(false);
    };

    const handleDelete = async () => {
        if (!selectedWeightRecord) return;
        setIsSaving(true);
        const ok = await handleDeleteWeight(selectedWeightRecord.id);
        setIsSaving(false);
        if (ok) setWeightModalOpen(false);
    };

    const recentWeights = sortWeightRecordsByLatest(weightRecords).slice(0, 10);

    return (
        <div className="hs-tab-content no-scrollbar">
            {/* Weight section */}
            <div className="hs-section-title"><span><Icon d={ICON_SCALE} /> 体重</span></div>
            <div className="hs-track-card hs-animate-fade-in" style={{ margin: '0 20px 16px' }}>
                <div className="hs-track-header">
                    <span className="hs-track-title">最新体重</span>
                    <span className="hs-track-value">{latestWeight ? `${latestWeight.weight} kg` : '—'}</span>
                </div>
                {latestWeight && latestBmi && (
                    <div className="hs-track-subtitle">BMI {latestBmi}</div>
                )}
                {weightDelta && (
                    <div className="hs-weight-delta neutral">{weightDelta.text}</div>
                )}
                <div className="hs-track-actions">
                    <button className="hs-track-btn" onClick={() => openWeightModal('morning')}><Icon d={ICON_SUN} /> 晨间</button>
                    <button className="hs-track-btn" onClick={() => openWeightModal('evening')}><Icon d={ICON_MOON} /> 晚间</button>
                </div>
            </div>

            {recentWeights.length > 0 && (
                <div className="hs-track-list" style={{ margin: '0 20px 20px' }}>
                    {recentWeights.map((r) => (
                        <div key={r.id} className="hs-track-list-item">
                            <div>
                                <div className="hs-track-list-title">{r.date}</div>
                                <div className="hs-track-subtitle">{r.timeOfDay === 'morning' ? '晨间' : '晚间'}</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.weight} kg</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Summaries section */}
            <div className="hs-section-title" style={{ marginTop: 8 }}><span><Icon d={ICON_CHART} /> 回顾</span></div>

            <div className="hs-track-cards" style={{ marginBottom: 8 }}>
                <div className="hs-track-card hs-animate-fade-in">
                    <div className="hs-track-header">
                        <span className="hs-track-title">本周</span>
                        <span className="hs-track-value">{getCurrentWeekRange()}</span>
                    </div>
                    <button className="hs-track-btn-full" onClick={() => void handleGenerateWeeklySummary()} disabled={isGeneratingSummary}>
                        {isGeneratingSummary ? '生成中…' : '生成周报'}
                    </button>
                </div>
                <div className="hs-track-card hs-animate-fade-in">
                    <div className="hs-track-header">
                        <span className="hs-track-title">本月</span>
                        <span className="hs-track-value">{getCurrentMonthKey()}</span>
                    </div>
                    <button className="hs-track-btn-full" onClick={() => void handleGenerateMonthlySummary()} disabled={isGeneratingSummary}>
                        {isGeneratingSummary ? '生成中…' : '生成月报'}
                    </button>
                </div>
            </div>

            {isSummaryListLoading && summaries.length === 0 && (
                <div className="hs-summary-generating">正在加载历史总结…</div>
            )}

            {summaries.length > 0 ? (
                <div className="hs-summary-list">
                    {summaries.map((summary) => (
                        <div key={summary.id} className="hs-summary-card hs-animate-fade-in">
                            <div className="hs-summary-card-header">
                                <span className={`hs-summary-period-badge ${summary.periodType === 'monthly' ? 'monthly' : ''}`}>
                                    {summary.periodType === 'weekly' ? '周报' : '月报'}
                                </span>
                                <span className="hs-summary-period-key">{summary.periodType === 'weekly' ? formatWeekKeyAsRange(summary.periodKey) : summary.periodKey}</span>
                                <span className="hs-summary-date-range">{summary.startDate} → {summary.endDate}</span>
                            </div>
                            <div className="hs-summary-text">{summary.summaryText}</div>
                            <div className="hs-summary-stats-grid">
                                <div className="hs-summary-stat">
                                    <div className="hs-summary-stat-value">{formatSummaryStatValue(summary.statsJson.avgCalories)}</div>
                                    <div className="hs-summary-stat-label">日均热量</div>
                                </div>
                                <div className="hs-summary-stat">
                                    <div className="hs-summary-stat-value">{summary.statsJson.weightChange !== undefined ? `${summary.statsJson.weightChange > 0 ? '+' : ''}${summary.statsJson.weightChange}kg` : '—'}</div>
                                    <div className="hs-summary-stat-label">体重变化</div>
                                </div>
                                <div className="hs-summary-stat">
                                    <div className="hs-summary-stat-value">{formatSummaryStatValue(summary.statsJson.exerciseCount)}</div>
                                    <div className="hs-summary-stat-label">运动次数</div>
                                </div>
                                <div className="hs-summary-stat">
                                    <div className="hs-summary-stat-value">{summary.statsJson.avgSleepMinutes !== undefined ? formatDurationMinutes(summary.statsJson.avgSleepMinutes) : '—'}</div>
                                    <div className="hs-summary-stat-label">平均睡眠</div>
                                </div>
                            </div>
                            <div className="hs-track-actions" style={{ marginTop: 12 }}>
                                <button className="hs-track-btn" onClick={() => void handleDeleteSummary(summary.id)}>删除</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : !isSummaryListLoading ? (
                <div className="hs-summary-empty">还没有回顾记录</div>
            ) : null}

            {/* Weight modal */}
            {weightModalOpen && (
                <BottomSheetModal title="记录体重" onClose={() => setWeightModalOpen(false)}>
                    <div className="hs-track-actions">
                        <button type="button" className="hs-track-btn" style={weightTimeOfDay === 'morning' ? { background: 'var(--hs-primary-bg)', color: 'var(--hs-primary-dark)' } : undefined} onClick={() => { setWeightTimeOfDay('morning'); const e = weightRecords.find((r) => r.date === todayDate && r.timeOfDay === 'morning'); setWeightValue(e?.weight?.toString() || ''); }}><Icon d={ICON_SUN} /> 晨间</button>
                        <button type="button" className="hs-track-btn" style={weightTimeOfDay === 'evening' ? { background: 'var(--hs-primary-bg)', color: 'var(--hs-primary-dark)' } : undefined} onClick={() => { setWeightTimeOfDay('evening'); const e = weightRecords.find((r) => r.date === todayDate && r.timeOfDay === 'evening'); setWeightValue(e?.weight?.toString() || ''); }}><Icon d={ICON_MOON} /> 晚间</button>
                    </div>
                    <div className="hs-form-input-with-unit">
                        <input type="number" inputMode="decimal" className="hs-form-input" value={weightValue} onChange={(e) => setWeightValue(e.target.value)} placeholder="62.5" />
                        <span className="hs-unit">kg</span>
                    </div>
                    <div className="hs-modal-action-row">
                        {selectedWeightRecord && (
                            <button type="button" className="hs-modal-secondary-btn" onClick={handleDelete} disabled={isSaving}>删除</button>
                        )}
                        <button type="button" className="hs-submit-btn hs-modal-submit-btn" onClick={handleSave} disabled={isSaving}>保存体重</button>
                    </div>
                </BottomSheetModal>
            )}
        </div>
    );
};

export default TrendsTab;
