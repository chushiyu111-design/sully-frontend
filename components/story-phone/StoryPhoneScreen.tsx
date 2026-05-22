import React from 'react';

export type StoryPhoneAppId =
    | 'messages'
    | 'notes'
    | 'photos'
    | 'calendar'
    | 'browser'
    | 'music'
    | 'maps'
    | 'clock'
    | 'wallet'
    | 'mail'
    | 'settings'
    | 'health';

export interface PhoneAppDef {
    id: StoryPhoneAppId;
    name: string;
    icon: string;
    color: string;
    prompt: string;
}

export interface PhoneClueItem {
    label: string;
    value: string;
    detail?: string;
}

export interface PhoneClue {
    appId: StoryPhoneAppId;
    appName: string;
    title: string;
    subtitle?: string;
    timestamp?: string;
    items: PhoneClueItem[];
    evidenceText: string;
    insertSummary: string;
}

export const PHONE_APPS: PhoneAppDef[] = [
    { id: 'messages', name: '信息', icon: '💬', color: 'from-emerald-400 to-green-600', prompt: '生成一段手机聊天/未发送消息/置顶会话线索。' },
    { id: 'notes', name: '备忘录', icon: '📝', color: 'from-amber-200 to-yellow-500', prompt: '生成一条备忘录、清单或私密随手记。' },
    { id: 'photos', name: '相册', icon: '🖼️', color: 'from-fuchsia-300 to-sky-400', prompt: '生成几张相册缩略图的文字描述，像用户翻到了相册最近项目。' },
    { id: 'calendar', name: '日历', icon: '📅', color: 'from-red-400 to-rose-600', prompt: '生成一个日历提醒、纪念日、行程或被隐藏的预约。' },
    { id: 'browser', name: '浏览器', icon: '🌐', color: 'from-blue-400 to-cyan-500', prompt: '生成近期搜索记录、浏览历史或未关闭网页标题。' },
    { id: 'music', name: '音乐', icon: '🎵', color: 'from-rose-400 to-pink-600', prompt: '生成最近循环、收藏歌词、歌单或播放记录。' },
    { id: 'maps', name: '地图', icon: '🧭', color: 'from-indigo-400 to-violet-600', prompt: '生成最近去过的地点、收藏地点或路线记录。' },
    { id: 'clock', name: '时钟', icon: '⏰', color: 'from-slate-600 to-slate-900', prompt: '生成闹钟、倒计时或某个异常时间提醒。' },
    { id: 'wallet', name: '钱包', icon: '💳', color: 'from-lime-400 to-emerald-600', prompt: '生成转账、订单付款、票据或余额变化线索。' },
    { id: 'mail', name: '邮件', icon: '✉️', color: 'from-sky-400 to-blue-600', prompt: '生成一封邮件标题、草稿或通知摘要。' },
    { id: 'health', name: '健康', icon: '♡', color: 'from-teal-300 to-emerald-500', prompt: '生成睡眠、步数、心率、用药或情绪记录线索。' },
    { id: 'settings', name: '设置', icon: '⚙️', color: 'from-zinc-400 to-zinc-700', prompt: '生成手机设置页里暴露的壁纸、专注模式、联系人备注或隐私状态。' },
];

export const pickRandomPhoneApp = () => PHONE_APPS[Math.floor(Math.random() * PHONE_APPS.length)] || PHONE_APPS[0];

export function getStoryPhoneAppById(appId?: string): PhoneAppDef | undefined {
    return PHONE_APPS.find(app => app.id === appId);
}

function getWallpaperStyle(wallpaper?: string): React.CSSProperties {
    const fallback = 'linear-gradient(145deg, #1f2937 0%, #0f172a 46%, #4c1d95 100%)';
    const value = wallpaper || fallback;
    if (value.startsWith('linear-gradient') || value.startsWith('radial-gradient')) {
        return { background: value };
    }
    return {
        backgroundImage: `url(${value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };
}

interface StoryPhoneScreenProps {
    charName: string;
    charAvatar?: string;
    wallpaper?: string;
    activeAppId: StoryPhoneAppId | 'home';
    spotlightApp?: PhoneAppDef;
    clue?: PhoneClue | null;
    isLoading?: boolean;
    inserted?: boolean;
    compact?: boolean;
    currentTime?: string;
    onBackHome?: () => void;
    onOpenApp?: (app: PhoneAppDef) => void;
    onGenerateApp?: (app: PhoneAppDef) => void;
    onPeekOnly?: () => void;
    onInsertContext?: () => void;
}

const StoryPhoneScreen: React.FC<StoryPhoneScreenProps> = ({
    charName,
    charAvatar,
    wallpaper,
    activeAppId,
    spotlightApp = PHONE_APPS[0],
    clue,
    isLoading = false,
    inserted = false,
    compact = false,
    currentTime,
    onBackHome,
    onOpenApp,
    onGenerateApp,
    onPeekOnly,
    onInsertContext,
}) => {
    const currentApp = activeAppId === 'home' ? undefined : getStoryPhoneAppById(activeAppId);
    const timeLabel = currentTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasActions = Boolean(clue && clue.appId === activeAppId && !isLoading && (onPeekOnly || onInsertContext));
    const frameClass = compact
        ? 'relative aspect-[9/16] w-full rounded-[1.75rem] bg-black p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.22)] ring-1 ring-black/10'
        : 'relative h-full max-h-[45rem] min-h-[34rem] w-full rounded-[2.35rem] bg-black p-2 shadow-[0_24px_80px_rgba(0,0,0,0.48)] ring-1 ring-white/10';
    const notchClass = compact
        ? 'absolute left-1/2 top-2 z-30 h-3.5 w-20 -translate-x-1/2 rounded-full bg-black'
        : 'absolute left-1/2 top-3 z-30 h-5 w-28 -translate-x-1/2 rounded-full bg-black';
    const screenRadius = compact ? 'rounded-[1.28rem]' : 'rounded-[1.8rem]';

    return (
        <div className={frameClass}>
            <div className={notchClass} />
            <div className={`relative h-full overflow-hidden ${screenRadius} bg-slate-900`} style={getWallpaperStyle(wallpaper)}>
                <div className="absolute inset-0 bg-black/25" />
                <div className="relative z-10 flex h-full flex-col">
                    <div className={`flex items-center justify-between text-white/90 ${compact ? 'h-7 px-4 pt-1 text-[8px] font-semibold' : 'h-10 px-5 pt-2 text-[11px] font-bold'}`}>
                        <span>{timeLabel}</span>
                        <div className="flex items-center gap-1.5">
                            <span>5G</span>
                            <div className={`${compact ? 'h-2 w-4' : 'h-2.5 w-5'} rounded-[3px] border border-current p-[1px]`}>
                                <div className="h-full w-4/5 rounded-[1px] bg-current" />
                            </div>
                        </div>
                    </div>

                    {activeAppId === 'home' ? (
                        <>
                            <div className={compact ? 'px-4 pb-2 pt-3' : 'px-5 pb-3 pt-4'}>
                                <div className={compact ? 'text-[9px] text-white/65' : 'text-[11px] text-white/65'}>有一个 App 刚刚亮了一下</div>
                                <div className={compact ? 'mt-1 text-lg font-bold leading-tight' : 'mt-1 text-2xl font-bold leading-tight'}>{spotlightApp.name}</div>
                            </div>
                            <div className={`grid grid-cols-4 ${compact ? 'gap-x-2 gap-y-4 px-4 pt-2' : 'gap-x-3 gap-y-6 px-5 pt-3'}`}>
                                {PHONE_APPS.map(app => {
                                    const active = app.id === spotlightApp.id;
                                    return (
                                        <button
                                            key={app.id}
                                            onClick={() => active ? onGenerateApp?.(app) : onOpenApp?.(app)}
                                            className="relative flex flex-col items-center gap-1.5 active:scale-95"
                                        >
                                            <span className={`relative flex ${compact ? 'h-10 w-10 rounded-xl text-lg' : 'h-14 w-14 rounded-2xl text-2xl'} items-center justify-center bg-gradient-to-br ${app.color} shadow-lg ring-1 ring-white/20`}>
                                                {app.icon}
                                                {active && <span className={`absolute -right-1 -top-1 rounded-full border-2 border-white bg-red-500 shadow ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
                                            </span>
                                            <span className={`${compact ? 'max-w-[3rem] text-[8px]' : 'max-w-[4rem] text-[10px]'} truncate font-medium text-white drop-shadow`}>{app.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="relative flex min-h-0 flex-1 flex-col bg-[#f6f7fb] text-slate-900">
                            <div className={`flex items-center justify-between border-b border-slate-200/80 bg-white/90 ${compact ? 'h-9 px-3' : 'h-12 px-4'}`}>
                                {onBackHome ? (
                                    <button onClick={onBackHome} className={`${compact ? 'text-lg' : 'text-xl'} text-slate-500`} aria-label="返回桌面">‹</button>
                                ) : (
                                    <span className={compact ? 'w-4' : 'w-5'} />
                                )}
                                <div className={`${compact ? 'text-xs' : 'text-sm'} min-w-0 truncate font-bold`}>{currentApp?.name || clue?.appName || 'App'}</div>
                                {onGenerateApp && currentApp ? (
                                    <button
                                        onClick={() => onGenerateApp(currentApp)}
                                        className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-bold text-slate-500`}
                                    >
                                        刷新
                                    </button>
                                ) : (
                                    <span className={compact ? 'w-5' : 'w-8'} />
                                )}
                            </div>

                            <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}>
                                {isLoading ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                                        <div className={`${compact ? 'h-7 w-7' : 'h-8 w-8'} animate-spin rounded-full border-2 border-slate-200 border-t-slate-500`} />
                                        <div className={compact ? 'text-[10px]' : 'text-xs'}>正在读取屏幕...</div>
                                    </div>
                                ) : clue && clue.appId === activeAppId ? (
                                    <div className={compact ? 'space-y-2' : 'space-y-3'}>
                                        <div className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'} bg-white shadow-sm`}>
                                            <div className={compact ? 'text-[9px] text-slate-400' : 'text-[11px] text-slate-400'}>{clue.timestamp}</div>
                                            <div className={`${compact ? 'mt-0.5 text-sm' : 'mt-1 text-lg'} font-bold text-slate-900`}>{clue.title}</div>
                                            {clue.subtitle && <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} text-slate-500`}>{clue.subtitle}</div>}
                                        </div>
                                        {clue.items.map((item, index) => (
                                            <div key={`${item.label}-${index}`} className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'} bg-white shadow-sm`}>
                                                <div className={compact ? 'text-[9px] font-bold text-slate-400' : 'text-[11px] font-bold text-slate-400'}>{item.label}</div>
                                                <div className={`${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm'} whitespace-pre-wrap leading-relaxed text-slate-800`}>{item.value}</div>
                                                {item.detail && <div className={`${compact ? 'mt-1 text-[10px]' : 'mt-2 text-xs'} whitespace-pre-wrap leading-relaxed text-slate-500`}>{item.detail}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                                        <div className={compact ? 'text-3xl' : 'text-4xl'}>{currentApp?.icon || '📱'}</div>
                                        <div className={compact ? 'text-[10px]' : 'text-xs'}>这里暂时没有新内容</div>
                                        {currentApp && onGenerateApp && (
                                            <button
                                                onClick={() => onGenerateApp(currentApp)}
                                                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white active:scale-95"
                                            >
                                                生成这页
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {hasActions && (
                                <div className={`grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 ${compact ? 'p-2' : 'p-3'}`}>
                                    <button
                                        onClick={onPeekOnly}
                                        className={`${compact ? 'rounded-xl py-2 text-[10px]' : 'rounded-2xl py-3 text-xs'} bg-slate-100 font-bold text-slate-500 active:scale-95`}
                                    >
                                        只看看
                                    </button>
                                    <button
                                        onClick={onInsertContext}
                                        disabled={inserted}
                                        className={`${compact ? 'rounded-xl py-2 text-[10px]' : 'rounded-2xl py-3 text-xs'} bg-slate-900 font-bold text-white active:scale-95 disabled:bg-emerald-500`}
                                    >
                                        {inserted ? '已放进剧情' : '放进剧情'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {charAvatar && (
                    <div className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/35 p-1 pr-2 text-white backdrop-blur-md ${compact ? 'hidden' : ''}`}>
                        <img src={charAvatar} className="h-6 w-6 rounded-full object-cover" alt={charName} />
                        <span className="max-w-[7rem] truncate text-[10px] font-semibold">{charName}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoryPhoneScreen;
