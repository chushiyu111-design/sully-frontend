/**
 * HalfSugarApp — 半糖主义 Multi-Tab Entry Point
 * Typographic sidebar + collapsible rail design.
 */
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { HalfSugarProvider, useHalfSugar, type TabID } from './HalfSugarContext';
import { OnboardingView } from './HalfSugarTrackingUI';
import './halfsugar.css';

// Lazy-load tabs for code-splitting
const DashboardTab = React.lazy(() => import('./tabs/DashboardTab'));
const NutritionTab = React.lazy(() => import('./tabs/NutritionTab'));
const ActivityTab = React.lazy(() => import('./tabs/ActivityTab'));
const SleepTab = React.lazy(() => import('./tabs/SleepTab'));
const TrendsTab = React.lazy(() => import('./tabs/TrendsTab'));
const ProfileTab = React.lazy(() => import('./tabs/ProfileTab'));
const LunarTidesTab = React.lazy(() => import('./tabs/LunarTidesTab'));

// ── Tab Definition (typographic — no icons) ──

interface TabDef {
    id: TabID;
    zh: string;        // Chinese label (natural length)
    en: string;        // English subtitle
    initial: string;   // Single char shown when collapsed
}

const ALWAYS_TABS: TabDef[] = [
    { id: 'dashboard',  zh: '今日',     en: 'Today',     initial: '今' },
    { id: 'nutrition',  zh: '饮食记录', en: 'Nutrition',  initial: '食' },
    { id: 'activity',   zh: '运动',     en: 'Activity',   initial: '动' },
    { id: 'sleep',      zh: '睡眠',     en: 'Sleep',      initial: '眠' },
];

const LUNAR_TIDES_TAB: TabDef = {
    id: 'lunar_tides', zh: '月相潮汐', en: 'Lunar', initial: '月',
};

const TRAILING_TABS: TabDef[] = [
    { id: 'trends',  zh: '趋势',  en: 'Trends',  initial: '趋' },
    { id: 'profile', zh: '我的',  en: 'Profile',  initial: '我' },
];

// ── Inner shell (must be inside Provider) ──

const HalfSugarInner: React.FC = () => {
    const {
        activeTab, setActiveTab, closeApp,
        isHealthSetup, healthProfile, onboardingGoalState,
        isSettingsSaving, handleOnboardingComplete, userProfile, goals,
        addToast,
    } = useHalfSugar();

    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const toggleSidebar = useCallback(() => setSidebarExpanded((p) => !p), []);

    const isFemale = healthProfile.gender === 'female';
    const tabs = useMemo(() => {
        const result = [...ALWAYS_TABS];
        if (isFemale) result.push(LUNAR_TIDES_TAB);
        result.push(...TRAILING_TABS);
        return result;
    }, [isFemale]);

    // Onboarding gate
    if (!isHealthSetup) {
        return (
            <div className="hs-app hs-screen" style={{ flexDirection: 'column' }}>
                <div className="hs-header">
                    <button type="button" className="hs-back-btn" onClick={closeApp}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                    </button>
                    <span className="hs-header-title">半糖主义</span>
                    <div className="hs-header-spacer" />
                </div>
                <div className="hs-scroll-area no-scrollbar">
                    <OnboardingView
                        initialProfile={healthProfile}
                        initialGoals={onboardingGoalState}
                        initialShareBodyInfo={(userProfile as any).healthShareBodyInfo === true}
                        hasPersistedGoals={goals.length > 0}
                        isSaving={isSettingsSaving}
                        onComplete={handleOnboardingComplete}
                    />
                </div>
            </div>
        );
    }

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab />;
            case 'nutrition': return <NutritionTab />;
            case 'activity': return <ActivityTab />;
            case 'sleep': return <SleepTab />;
            case 'lunar_tides': return <LunarTidesTab addToast={addToast} />;
            case 'trends': return <TrendsTab />;
            case 'profile': return <ProfileTab />;
            default: return <DashboardTab />;
        }
    };

    return (
        <div className="hs-app hs-screen">
            {/* Collapsible Left Sidebar */}
            <nav className={`hs-sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}>
                {/* Toggle area — click to expand/collapse */}
                <button type="button" className="hs-sidebar-toggle" onClick={toggleSidebar} aria-label="切换侧边栏">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14"
                        style={{ transform: sidebarExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>

                {/* Tab list */}
                <div className="hs-sidebar-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`hs-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => { setActiveTab(tab.id); if (sidebarExpanded) setSidebarExpanded(false); }}
                            aria-label={tab.zh}
                        >
                            {/* Collapsed: single character */}
                            <span className="hs-sidebar-initial">{tab.initial}</span>
                            {/* Expanded: full text */}
                            <span className="hs-sidebar-text">
                                <span className="hs-sidebar-zh">{tab.zh}</span>
                                <span className="hs-sidebar-en">{tab.en}</span>
                            </span>
                        </button>
                    ))}
                </div>

                {/* Back button at bottom */}
                <button type="button" className="hs-sidebar-back" onClick={closeApp} aria-label="返回">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
            </nav>

            {/* Main Content */}
            <div className="hs-main-content">
                <Suspense fallback={<div className="hs-tab-content"><div className="hs-loading-card">加载中…</div></div>}>
                    {renderTab()}
                </Suspense>
            </div>
        </div>
    );
};

// ── Root ──

const HalfSugarApp: React.FC = () => (
    <HalfSugarProvider>
        <HalfSugarInner />
    </HalfSugarProvider>
);

export default HalfSugarApp;
