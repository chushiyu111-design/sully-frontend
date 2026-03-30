
import React, { useEffect } from 'react';
import { VirtualTimeProvider } from './context/VirtualTimeContext';
import { OSProvider } from './context/OSContext';
import PhoneShell from './components/PhoneShell';

/**
 * 检测是否运行在 PWA (已安装到桌面) 模式
 */
function isPwaMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as any).standalone === true
  );
}

/**
 * 请求系统级全屏 (Fullscreen API)
 * 隐藏安卓状态栏 + 导航栏
 */
export function requestSystemFullscreen() {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const request =
    el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).mozRequestFullScreen ||
    (el as any).msRequestFullscreen;
  if (request && !document.fullscreenElement) {
    request.call(el).catch(() => {
      // 静默失败 —— 某些浏览器/系统不支持
    });
  }
}

const App: React.FC = () => {
  useEffect(() => {
    if (!isPwaMode()) return;

    // 积极维护全屏状态：任何点击或触摸（用户手势）都会尝试恢复全屏
    // 这是为了解决 Android 侧滑返回、键盘收起时意外退出全屏的 Bug
    const ensureFullscreen = () => {
      requestSystemFullscreen();
    };

    document.addEventListener('click', ensureFullscreen, { capture: true, passive: true });
    document.addEventListener('touchstart', ensureFullscreen, { capture: true, passive: true });

    return () => {
      document.removeEventListener('click', ensureFullscreen, { capture: true } as any);
      document.removeEventListener('touchstart', ensureFullscreen, { capture: true } as any);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-black overflow-hidden">
      <div
        className="fixed inset-0 w-full h-full z-0 bg-black"
        style={{ transform: 'translateZ(0)' }}
      >
        <VirtualTimeProvider>
          <OSProvider>
            <PhoneShell />
          </OSProvider>
        </VirtualTimeProvider>
      </div>
    </div>
  );
};

export default App;
