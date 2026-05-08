/**
 * TheaterMap — 场景地图 · 卡片式地点选择
 * 横向双列卡片网格 + 时间显示 + 花瓣飘落(520限定)
 */

import React, { useState } from 'react';
import type { TheaterLocation, TimeSlot } from '../../types';
import { TIME_SLOT_LABELS } from '../../types/theater';
import LocationEditor from './LocationEditor';

const TAG_LABELS: Record<string, string> = {
    romantic: '浪漫',
    daily: '日常',
    adventure: '冒险',
    quiet: '安静',
    crowded: '热闹',
    outdoor: '户外',
    indoor: '室内',
};

interface TheaterMapProps {
    locations: TheaterLocation[];
    timeSlot: TimeSlot;
    is520: boolean;
    visitedLocationIds: string[];
    onSelectLocation: (location: TheaterLocation) => void;
    onAddLocation: (location: TheaterLocation) => void;
    onDeleteCustomLocation: (id: string) => void;
    onBack: () => void;
}

const TheaterMap: React.FC<TheaterMapProps> = ({
    locations,
    timeSlot,
    is520,
    visitedLocationIds,
    onSelectLocation,
    onAddLocation,
    onDeleteCustomLocation,
    onBack,
}) => {
    const [showEditor, setShowEditor] = useState(false);
    const timeLabel = TIME_SLOT_LABELS[timeSlot];

    const handleLongPress = (locId: string, isPreset: boolean) => {
        if (isPreset) return;
        if (window.confirm('删除这个自定义地点？')) {
            onDeleteCustomLocation(locId);
        }
    };

    return (
        <div className="theater-map">
            {/* 520 Petals */}
            {is520 && (
                <div className="theater-petals">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="theater-petal" />
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="theater-map-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="theater-back-btn" onClick={onBack}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={18} height={18}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <div>
                        <div className="theater-map-title">
                            {is520 ? '520 约会剧场' : '约会剧场'}
                        </div>
                        <div className="theater-map-subtitle">
                            {is520 ? 'Special 520 Theater' : 'Date Theater'}
                        </div>
                    </div>
                </div>

                <div className="theater-time-badge">
                    <span className="theater-time-icon">{timeLabel.icon}</span>
                    <span>{timeLabel.zh}</span>
                </div>
            </div>

            {/* Location Cards Grid */}
            <div className="theater-card-scroll">
                <div className="theater-card-grid">
                    {locations.map(loc => {
                        const visited = visitedLocationIds.includes(loc.id);
                        return (
                            <div
                                key={loc.id}
                                className="theater-card"
                                onClick={() => onSelectLocation(loc)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleLongPress(loc.id, loc.isPreset);
                                }}
                            >
                                {/* Background */}
                                <div
                                    className="theater-card-bg"
                                    style={{
                                        background: loc.bgImage
                                            ? `url(${loc.bgImage}) center/cover`
                                            : loc.bgGradient || 'linear-gradient(135deg, #333, #555)',
                                    }}
                                />

                                {/* Overlay */}
                                <div className="theater-card-overlay">
                                    <div className="theater-card-name">{loc.name}</div>
                                    {loc.nameEn && <div className="theater-card-name-en">{loc.nameEn}</div>}
                                    <div className="theater-card-tags">
                                        {loc.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="theater-card-tag">
                                                {TAG_LABELS[tag] || tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Visit Badge */}
                                {loc.visitCount > 0 && (
                                    <div className="theater-card-visits">
                                        来过 {loc.visitCount} 次
                                    </div>
                                )}

                                {/* Current Session Visited */}
                                {visited && (
                                    <div style={{
                                        position: 'absolute', top: 10, left: 10,
                                        fontSize: 9, fontWeight: 700,
                                        color: '#64c8ff',
                                        background: 'rgba(100, 200, 255, 0.15)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(100, 200, 255, 0.3)',
                                        padding: '3px 8px', borderRadius: 8,
                                    }}>
                                        ✓ 今天去过
                                    </div>
                                )}

                                {/* Custom Badge */}
                                {!loc.isPreset && !visited && (
                                    <div className="theater-card-custom-badge">自定义</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Add Location Button */}
            <button className="theater-add-btn" onClick={() => setShowEditor(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width={18} height={18}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                新增地点
            </button>

            {/* Location Editor */}
            <LocationEditor
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                onSave={onAddLocation}
            />
        </div>
    );
};

export default TheaterMap;
