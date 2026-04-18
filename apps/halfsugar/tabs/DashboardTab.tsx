/**
 * DashboardTab — Today's overview with calorie ring, macros, and summary cards
 */
import React from 'react';
import { useHalfSugar } from '../HalfSugarContext';
import { CalorieRing } from '../components/CalorieRing';
import { MacroBar } from '../components/MacroBar';
import { formatDurationMinutes } from '../types';

/** Monochrome inline SVG icon — single color, outline style */
const Icon: React.FC<{ d: string; size?: number }> = ({ d, size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={size} height={size} style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

const ICON_NUTRITION = 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513';
const ICON_SCALE = 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97ZM5.25 4.97l-2.62 10.726c-.122.499.106 1.028.589 1.202a5.989 5.989 0 002.031.352 5.989 5.989 0 002.031-.352c.483-.174.711-.703.59-1.202L5.25 4.971Z';
const ICON_ACTIVITY = 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z';
const ICON_SLEEP = 'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998Z';

const DashboardTab: React.FC = () => {
    const {
        activeCalorieTarget, caloriesConsumed, proteinConsumed, carbsConsumed, fatConsumed, fiberConsumed,
        nutrientTargets, recommendations, isMealsLoading, isTrackingLoading,
        latestWeight, latestBmi, weightDelta, todayExerciseCalories, todaySleep,
        todayExercises, setActiveTab,
    } = useHalfSugar();

    // Show total exercise duration instead of negative kcal
    const totalExerciseMinutes = todayExercises.reduce((sum, e) => sum + e.durationMinutes, 0);

    return (
        <div className="hs-tab-content no-scrollbar">
            <CalorieRing consumed={caloriesConsumed} target={activeCalorieTarget} />

            <div className="hs-macros">
                <MacroBar label="蛋白" value={proteinConsumed} target={nutrientTargets.protein} color="var(--hs-sage)" />
                <MacroBar label="碳水" value={carbsConsumed} target={nutrientTargets.carbs} color="var(--hs-clay)" />
                <MacroBar label="脂肪" value={fatConsumed} target={nutrientTargets.fat} color="var(--hs-rose)" />
                <MacroBar label="纤维" value={fiberConsumed} target={nutrientTargets.fiber} color="var(--hs-ocean)" />
            </div>

            {recommendations.length > 0 && (
                <div className="hs-recommendation-section hs-animate-fade-in">
                    <div className="hs-section-title">今日参考</div>
                    {recommendations.map((rec) => (
                        <div key={rec.nutrient} className="hs-recommendation-card">
                            <div className="hs-rec-header">{rec.label} {Math.round(rec.current)} / {Math.round(rec.target)}g</div>
                            <div className="hs-rec-foods">
                                {rec.foods.slice(0, 3).map((food) => (
                                    <span key={food.name} className="hs-rec-food-chip">{food.name}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick-access summary cards */}
            <div className="hs-track-cards">
                <div className="hs-track-card hs-animate-fade-in" onClick={() => setActiveTab('nutrition')} role="button" tabIndex={0}>
                    <div className="hs-track-header">
                        <span className="hs-track-title"><Icon d={ICON_NUTRITION} /> 饮食</span>
                        <span className="hs-track-value">
                            {isMealsLoading ? '同步中…' : `${caloriesConsumed} kcal`}
                        </span>
                    </div>
                    <div className="hs-track-subtitle" style={{ fontSize: 12, color: 'var(--hs-text-muted)' }}>
                        点击查看详情
                    </div>
                </div>

                <div className="hs-track-card hs-animate-fade-in" onClick={() => setActiveTab('trends')} role="button" tabIndex={0}>
                    <div className="hs-track-header">
                        <span className="hs-track-title"><Icon d={ICON_SCALE} /> 体重</span>
                        <span className="hs-track-value">
                            {latestWeight ? `${latestWeight.weight} kg` : '—'}
                        </span>
                    </div>
                    {latestWeight && latestBmi && (
                        <div className="hs-track-subtitle">BMI {latestBmi}</div>
                    )}
                    {weightDelta && (
                        <div className="hs-weight-delta neutral">{weightDelta.text}</div>
                    )}
                </div>
            </div>

            <div className="hs-track-cards">
                <div className="hs-track-card hs-animate-fade-in" onClick={() => setActiveTab('activity')} role="button" tabIndex={0}>
                    <div className="hs-track-header">
                        <span className="hs-track-title"><Icon d={ICON_ACTIVITY} /> 运动</span>
                        <span className="hs-track-value">
                            {totalExerciseMinutes > 0 ? `${totalExerciseMinutes} 分钟` : '—'}
                        </span>
                    </div>
                    {todayExercises.length > 0 && (
                        <div className="hs-track-subtitle">
                            {todayExercises.map((e) => e.exerciseLabel).join('、')}
                        </div>
                    )}
                </div>

                <div className="hs-track-card hs-animate-fade-in" onClick={() => setActiveTab('sleep')} role="button" tabIndex={0}>
                    <div className="hs-track-header">
                        <span className="hs-track-title"><Icon d={ICON_SLEEP} /> 睡眠</span>
                        <span className="hs-track-value">
                            {todaySleep ? formatDurationMinutes(todaySleep.durationMinutes) : '—'}
                        </span>
                    </div>
                    {todaySleep && (
                        <div className="hs-track-subtitle">
                            {todaySleep.sleepTime} → {todaySleep.wakeTime}
                        </div>
                    )}
                </div>
            </div>

            {(isMealsLoading || isTrackingLoading) && (
                <div className="hs-loading-card">正在同步今日记录…</div>
            )}
        </div>
    );
};

export default DashboardTab;
