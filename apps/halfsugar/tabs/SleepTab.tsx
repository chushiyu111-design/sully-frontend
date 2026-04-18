/**
 * SleepTab — Sleep recording and quality tracking
 */
import React, { useMemo, useState } from 'react';
import { useHalfSugar } from '../HalfSugarContext';
import { BottomSheetModal } from '../HalfSugarTrackingUI';
import { computeSleepDurationMinutes, formatDurationMinutes, type SleepQuality } from '../types';

/** Monochrome moon icon */
const MoonIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width="16" height="16" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998Z" />
    </svg>
);

const SleepTab: React.FC = () => {
    const { todaySleep, handleSaveSleep, handleDeleteSleep } = useHalfSugar();

    const [showModal, setShowModal] = useState(false);
    const [sleepTime, setSleepTime] = useState(todaySleep?.sleepTime || '23:30');
    const [wakeTime, setWakeTime] = useState(todaySleep?.wakeTime || '07:00');
    const [quality, setQuality] = useState<SleepQuality>(todaySleep?.quality || 'good');
    const [isSaving, setIsSaving] = useState(false);

    const previewDuration = useMemo(() => {
        if (!sleepTime || !wakeTime) return 0;
        return computeSleepDurationMinutes(sleepTime, wakeTime);
    }, [sleepTime, wakeTime]);

    const openModal = () => {
        setSleepTime(todaySleep?.sleepTime || '23:30');
        setWakeTime(todaySleep?.wakeTime || '07:00');
        setQuality(todaySleep?.quality || 'good');
        setShowModal(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const ok = await handleSaveSleep(sleepTime, wakeTime, quality);
        setIsSaving(false);
        if (ok) setShowModal(false);
    };

    const handleDelete = async () => {
        setIsSaving(true);
        const ok = await handleDeleteSleep();
        setIsSaving(false);
        if (ok) setShowModal(false);
    };

    const qualityLabel = (q: SleepQuality) => q === 'good' ? '很好' : q === 'fair' ? '还行' : '不太好';

    return (
        <div className="hs-tab-content no-scrollbar">
            <div className="hs-section-title">
                <span>今日睡眠</span>
                <span>{todaySleep ? formatDurationMinutes(todaySleep.durationMinutes) : ''}</span>
            </div>

            {todaySleep ? (
                <div className="hs-track-card hs-animate-fade-in" style={{ margin: '0 20px 16px' }}>
                    <div className="hs-track-header">
                        <span className="hs-track-title"><MoonIcon /> 睡眠记录</span>
                        <span className="hs-track-value">{formatDurationMinutes(todaySleep.durationMinutes)}</span>
                    </div>
                    <div className="hs-track-subtitle">{todaySleep.sleepTime} → {todaySleep.wakeTime}</div>
                    {todaySleep.quality && (
                        <div className="hs-track-subtitle" style={{ color: 'var(--hs-text-secondary)', fontWeight: 600, marginTop: 4 }}>
                            {qualityLabel(todaySleep.quality)}
                        </div>
                    )}
                    <button className="hs-track-btn-full" onClick={openModal} style={{ marginTop: 10 }}>编辑</button>
                </div>
            ) : (
                <div className="hs-loading-card" style={{ color: 'var(--hs-text-muted)' }}>还没有睡眠记录</div>
            )}

            <button type="button" className="hs-meal-add hs-animate-fade-in" onClick={openModal}>
                <span>＋</span> {todaySleep ? '编辑睡眠' : '记录睡眠'}
            </button>

            {showModal && (
                <BottomSheetModal title="记录睡眠" onClose={() => setShowModal(false)}>
                    <div className="hs-time-pair">
                        <input type="time" className="hs-time-input" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
                        <span className="hs-time-separator">→</span>
                        <input type="time" className="hs-time-input" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
                    </div>
                    <div className="hs-quality-row">
                        {(['good', 'fair', 'poor'] as SleepQuality[]).map((q) => (
                            <button key={q} type="button" className={`hs-quality-chip ${quality === q ? 'active' : ''}`} onClick={() => setQuality(q)}>
                                {qualityLabel(q)}
                            </button>
                        ))}
                    </div>
                    <div className="hs-track-subtitle">预计时长 {formatDurationMinutes(previewDuration)}</div>
                    <div className="hs-modal-action-row">
                        {todaySleep && (
                            <button type="button" className="hs-modal-secondary-btn" onClick={handleDelete} disabled={isSaving}>删除</button>
                        )}
                        <button type="button" className="hs-submit-btn hs-modal-submit-btn" onClick={handleSave} disabled={isSaving}>保存睡眠</button>
                    </div>
                </BottomSheetModal>
            )}
        </div>
    );
};

export default SleepTab;
