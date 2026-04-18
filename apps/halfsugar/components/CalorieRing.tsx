import React from 'react';

/** Gentle narration based on intake progress — never punitive */
function getRingNarration(consumed: number, target: number): string {
    if (consumed === 0) return '新的一天，慢慢来';
    const ratio = consumed / Math.max(target, 1);
    if (ratio < 0.3) return '已开始记录';
    if (ratio < 0.6) return '记录中';
    if (ratio < 0.85) return '今天吃得很均衡';
    if (ratio <= 1.05) return '今日份圆满';
    if (ratio <= 1.3) return '充实的一天，也很好';
    return '能量满满，好好享受吧';
}

export const CalorieRing: React.FC<{ consumed: number; target: number }> = React.memo(({ consumed, target }) => {
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(consumed / Math.max(target, 1), 1);
    const dashOffset = circumference * (1 - progress);

    return (
        <div className="hs-ring-container hs-animate-ring">
            <div className="hs-ring-wrapper">
                <div className="hs-ring-inner">
                    <svg className="hs-ring-svg" viewBox="0 0 174 174">
                        <circle className="hs-ring-bg" cx="87" cy="87" r={radius} />
                        <circle
                            className="hs-ring-progress"
                            cx="87"
                            cy="87"
                            r={radius}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                        />
                    </svg>
                    <div className="hs-ring-center">
                        <span className="hs-ring-value">{consumed.toLocaleString()}</span>
                        <span className="hs-ring-unit">kcal</span>
                    </div>
                </div>
            </div>
            <div className="hs-ring-narration">{getRingNarration(consumed, target)}</div>
        </div>
    );
});
