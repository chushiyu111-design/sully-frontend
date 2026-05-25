import React,{ useState,useEffect } from 'react';

const UPDATE_VERSION_KEY = 'sullyos_update_seen_version';
export const CURRENT_VERSION = 'v2.11.0';

const UPDATE_LOGS = [
    {
        title: '1. 查手机上线',
        desc: '聊天页面现在可以查看 char 的小手机了。\n\n查到的内容可以塞进当前剧情里，让他亲自解释——\n或者说，亲自狡辩。\n\n聊天记录、页面内容、心声卡片等也都做了相关性升级，会更贴近当前聊天。'
    },
    {
        title: '2. ElevenLabs 语音接口',
        desc: '新增 ElevenLabs 语音接口，目前主要用于通话模式。\n\n相比 minimax，ElevenLabs 会更适合外国 char、人机恋、偏真实感或影视感的声线。\n\n也新增了让 char 自己给自己捏声线的小设计，用不用都可以，当作参考也很可爱。\n\n试听效果可以参考吱的小红书视频。'
    },
    {
        title: '3. Soft Devotion Chat',
        desc: '新增 soft devotion chat。\n\n开启后，char 的共情、安抚、低压陪伴能力会更明显。\n\n适合想要被好好哄一哄的时候使用，实测吵架使用风味更佳。'
    },
    {
        title: '4. 昨日来信 / 回望·周章 / 回望·月章',
        desc: '新增回顾类小报功能。\n\n它会把过去一天、一周、一个月的聊天整理成娱乐小报一样的形式，支持高清原图导出。\n\n开关在聊天设置里。'
    }
];

interface UpdatePopupProps {
    canShow: boolean; // Control whether it's allowed to show (e.g., after disclaimer)
}

const UpdatePopup: React.FC<UpdatePopupProps> = ({ canShow }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (canShow) {
            try {
                const seenVersion = localStorage.getItem(UPDATE_VERSION_KEY);
                if (seenVersion !== CURRENT_VERSION) {
                    // Delay a tiny bit for smooth transition if needed, avoid stacking animations
                    setTimeout(() => setIsVisible(true), 300);
                }
            } catch (e) {
                setIsVisible(true);
            }
        }
    }, [canShow]);

    const handleClose = () => {
        try {
            localStorage.setItem(UPDATE_VERSION_KEY, CURRENT_VERSION);
        } catch (e) { /* ignore */ }
        setIsVisible(false);
    };

    if (!isVisible || !canShow) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-5 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={handleClose} />
            <div className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/30 overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="pt-7 pb-4 px-6 text-center">
                    <div className="text-4xl mb-3 animate-bounce">💌</div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">发现新版本 {CURRENT_VERSION}</h2>
                    </div>
                    <p className="text-[12px] text-slate-400 mt-1 font-medium">5.25 更新 · Csy 手抓糯米机</p>
                </div>

                {/* Content */}
                <div className="px-6 pb-6 max-h-[55vh] overflow-y-auto no-scrollbar space-y-4">
                    {UPDATE_LOGS.map((log, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                            <h3 className="text-[14px] font-bold text-slate-800 mb-1.5">{log.title}</h3>
                            <p className="text-[12px] text-slate-500 leading-relaxed font-medium whitespace-pre-line">
                                {log.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 pb-7 pt-2">
                    <button
                        onClick={handleClose}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-transform text-sm tracking-wide"
                    >
                        我知道了，不再提示
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdatePopup;
