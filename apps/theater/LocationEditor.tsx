/**
 * LocationEditor — 用户自定义地点编辑器 Modal
 */

import React, { useState } from 'react';
import type { TheaterLocation, LocationTag } from '../../types';
import Modal from '../../components/os/Modal';

const ALL_TAGS: { value: LocationTag; label: string }[] = [
    { value: 'romantic', label: '🌹 浪漫' },
    { value: 'daily',    label: '☕ 日常' },
    { value: 'adventure', label: '🎢 冒险' },
    { value: 'quiet',    label: '🤫 安静' },
    { value: 'crowded',  label: '👥 热闹' },
    { value: 'outdoor',  label: '🌿 户外' },
    { value: 'indoor',   label: '🏠 室内' },
];

const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
];

interface LocationEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (location: TheaterLocation) => void;
    editingLocation?: TheaterLocation | null;
}

const LocationEditor: React.FC<LocationEditorProps> = ({ isOpen, onClose, onSave, editingLocation }) => {
    const [name, setName] = useState(editingLocation?.name || '');
    const [nameEn, setNameEn] = useState(editingLocation?.nameEn || '');
    const [description, setDescription] = useState(editingLocation?.description || '');
    const [tags, setTags] = useState<LocationTag[]>(editingLocation?.tags || ['daily']);
    const [selectedGradient, setSelectedGradient] = useState(editingLocation?.bgGradient || PRESET_GRADIENTS[0]);

    const toggleTag = (tag: LocationTag) => {
        setTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleSave = () => {
        if (!name.trim() || !description.trim()) return;

        const location: TheaterLocation = {
            id: editingLocation?.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: name.trim(),
            nameEn: nameEn.trim() || undefined,
            description: description.trim(),
            tags: tags.length > 0 ? tags : ['daily'],
            bgGradient: selectedGradient,
            isPreset: false,
            visitCount: editingLocation?.visitCount || 0,
            lastVisitTime: editingLocation?.lastVisitTime,
        };

        onSave(location);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} title={editingLocation ? "编辑地点" : "新增地点"} onClose={onClose} footer={
            <div className="flex gap-3 w-full">
                <button onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-2xl text-white/50 font-bold text-sm">取消</button>
                <button
                    onClick={handleSave}
                    disabled={!name.trim() || !description.trim()}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-30"
                    style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44569)' }}
                >
                    {editingLocation ? '保存修改' : '创建地点'}
                </button>
            </div>
        }>
            <div className="space-y-4" style={{ color: '#fff' }}>
                {/* Name */}
                <div className="theater-editor-field">
                    <label className="theater-editor-label">地点名称 *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="例如：后山秘密基地"
                        className="theater-editor-input"
                        maxLength={20}
                    />
                </div>

                {/* English Name */}
                <div className="theater-editor-field">
                    <label className="theater-editor-label">英文副标题（可选）</label>
                    <input
                        type="text"
                        value={nameEn}
                        onChange={e => setNameEn(e.target.value)}
                        placeholder="例如：Secret Base"
                        className="theater-editor-input"
                        maxLength={30}
                    />
                </div>

                {/* Description */}
                <div className="theater-editor-field">
                    <label className="theater-editor-label">氛围描述 * <span style={{ color: 'rgba(255,255,255,0.3)' }}>（100-200字，越详细剧情越好）</span></label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="描述这个地方的环境、气氛、声音、气味……越有画面感越好。导演会根据这段描述来设计事件。"
                        className="theater-editor-input theater-editor-textarea"
                        maxLength={300}
                    />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 }}>
                        {description.length}/300
                    </div>
                </div>

                {/* Tags */}
                <div className="theater-editor-field">
                    <label className="theater-editor-label">场景标签</label>
                    <div className="theater-editor-tags">
                        {ALL_TAGS.map(t => (
                            <button
                                key={t.value}
                                onClick={() => toggleTag(t.value)}
                                className={`theater-editor-tag-btn ${tags.includes(t.value) ? 'selected' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Background Gradient */}
                <div className="theater-editor-field">
                    <label className="theater-editor-label">卡片背景色</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {PRESET_GRADIENTS.map((g, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedGradient(g)}
                                style={{
                                    width: 36, height: 36,
                                    borderRadius: 12,
                                    background: g,
                                    border: selectedGradient === g ? '2px solid #fff' : '2px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s',
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default LocationEditor;
