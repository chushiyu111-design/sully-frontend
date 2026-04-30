import React,{ useState,useEffect } from 'react';

const UPDATE_VERSION_KEY = 'sullyos_update_seen_version';
export const CURRENT_VERSION = 'v2.9.0';

const UPDATE_LOGS = [
    {
        title: '1. 让 char 登陆微信',
        desc: '扫码把 char 接入微信，char 能够主动在微信上发消息轰炸（暗中观察之）。'
    },
    {
        title: '2. 和 char 一起写歌，写属于我们的歌',
        desc: '回忆唱片匣更新：写和 char 的主题曲、同人曲，支持在小手机本体中播放，也支持导出播放。\n\n可以和 char 一起听我们的主题曲，吱超爱的功能 +1 +1。'
    },
    {
        title: '3. 记忆系统更新优化（未完结）',
        desc: '实测效果提升，不会再出现揪着一件小事不放、把一件事当做锚点反复提及的情况。'
    },
    {
        title: '4. 角色城市生活系统进度条缓慢增加（未完结）',
        desc: '完善日程锚点逻辑，让 char 的日程由自己安排的同时，会自动根据聊天内容协调日程。'
    },
    {
        title: '5. 状态栏工坊',
        desc: '自定义角色 HTML 状态栏，具体用法可以查看二改手册。'
    },
    {
        title: '6. 见面模式悬浮球',
        desc: '线下模式新增自动总结、自动隐藏总结过的内容，用来压缩 token。\n\n总结面板改为自由拖拽的悬浮球形式，点击即可召出，不影响视觉阅读体验。'
    },
    {
        title: '7. Emo Cloud 功能优化',
        desc: '页面 UI 优化，支持添加收藏、我喜欢等功能，并与真实网易云音乐双端互通。'
    },
    {
        title: '8. 云端自动备份',
        desc: '只要记住自己的设备码，就不必担心本地浏览器清缓存之类的问题，多个浏览器、多端互通。'
    },
    {
        title: '教程入口',
        desc: '以上，具体教程请大家移步小手机中的二改手册（鸣谢 ds 老师）。'
    },
    {
        title: '修复',
        desc: '1. 修复气泡工坊导入导出不可用。\n2. 修复云备份流量异常。\n3. 修复设置页面卡顿。'
    },
    {
        title: '协议说明',
        desc: '为了明确项目边界，保护原作者与后续维护者的权益，本仓库协议已对齐上游 SullyOS，采用 PolyForm Noncommercial License 1.0.0。'
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
                    <div className="text-4xl mb-3 animate-bounce">🎊</div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">发现新版本 {CURRENT_VERSION}</h2>
                    </div>
                    <p className="text-[12px] text-slate-400 mt-1 font-medium">Csy二改糯米机更新日志</p>
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
