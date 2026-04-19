import React from 'react';
import { getDailyNarration } from '../foodRecommendations';

/** Default exercise calorie goal for the middle ring (kcal) */
const DEFAULT_EXERCISE_GOAL = 300;

interface CalorieRingProps {
    consumed: number;
    exerciseBurned: number;
    target: number;
}

export const CalorieRing: React.FC<CalorieRingProps> = React.memo(({ consumed, exerciseBurned, target }) => {
    const outerR = 72;
    const midR = 58;
    const innerR = 44;
    const strokeWidth = 6;

    const outerCirc = 2 * Math.PI * outerR;
    const midCirc = 2 * Math.PI * midR;
    const innerCirc = 2 * Math.PI * innerR;

    const intakeProgress = Math.min(consumed / Math.max(target, 1), 1);
    const exerciseProgress = Math.min(exerciseBurned / DEFAULT_EXERCISE_GOAL, 1);
    const net = Math.max(consumed - exerciseBurned, 0);
    const netProgress = Math.min(net / Math.max(target, 1), 1);

    const outerOffset = outerCirc * (1 - intakeProgress);
    const midOffset = midCirc * (1 - exerciseProgress);
    const innerOffset = innerCirc * (1 - netProgress);

    const narration = getDailyNarration();

    return (
        <div className="hs-ring-container hs-animate-ring">
            <div className="hs-ring-wrapper">
                <div className="hs-ring-inner">
                    <svg className="hs-ring-svg" viewBox="0 0 174 174">
                        {/* Background tracks */}
                        <circle className="hs-ring-bg" cx="87" cy="87" r={outerR} strokeWidth={strokeWidth} />
                        <circle className="hs-ring-bg" cx="87" cy="87" r={midR} strokeWidth={strokeWidth} />
                        <circle className="hs-ring-bg" cx="87" cy="87" r={innerR} strokeWidth={strokeWidth} />

                        {/* Progress arcs */}
                        <circle
                            className="hs-ring-progress hs-ring-intake"
                            cx="87" cy="87" r={outerR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={outerCirc}
                            strokeDashoffset={outerOffset}
                        />
                        <circle
                            className="hs-ring-progress hs-ring-exercise"
                            cx="87" cy="87" r={midR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={midCirc}
                            strokeDashoffset={midOffset}
                        />
                        <circle
                            className="hs-ring-progress hs-ring-net"
                            cx="87" cy="87" r={innerR}
                            strokeWidth={strokeWidth}
                            strokeDasharray={innerCirc}
                            strokeDashoffset={innerOffset}
                        />
                    </svg>
                    <div className="hs-ring-center">
                        <span className="hs-ring-value">{consumed.toLocaleString()}</span>
                        <span className="hs-ring-unit">摄入 kcal</span>
                    </div>
                </div>
            </div>

            {/* Quick stats row below ring */}
            <div className="hs-ring-stats">
                <div className="hs-ring-stat">
                    <span className="hs-ring-stat-dot" style={{ background: 'var(--hs-clay)' }} />
                    <span className="hs-ring-stat-label">消耗</span>
                    <span className="hs-ring-stat-value">{exerciseBurned}</span>
                </div>
                <div className="hs-ring-stat">
                    <span className="hs-ring-stat-dot" style={{ background: 'var(--hs-ocean)' }} />
                    <span className="hs-ring-stat-label">净</span>
                    <span className="hs-ring-stat-value">{net.toLocaleString()}</span>
                </div>
            </div>

            <div className="hs-ring-narration">{narration}</div>
        </div>
    );
});
