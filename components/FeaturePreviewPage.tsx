import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  Brain,
  CaretDown,
  ChatTeardrop,
  Compass,
  Fire,
  GameController,
  GearSix,
  Globe,
  Heart,
  Heartbeat,
  House,
  IdentificationCard,
  Images,
  MusicNote,
  Notebook,
  PaintBrush,
  Palette,
  Path,
  PenNib,
  Phone,
  PiggyBank,
  Question,
  SealCheck,
  Sparkle,
  Star,
  TrendUp,
  UsersThree,
  Wrench,
  Books,
  Camera,
  DeviceMobileCamera,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

/* ─── Types ────────────────────────────────────────────── */

interface FeaturePreviewPageProps {
  onEnterApp: () => void;
}

interface FeatureItem {
  icon: Icon;
  name: string;
  desc: string;
}

interface FeatureCategory {
  id: string;
  emoji: string;
  title: string;
  color: string;       // bg color for category header pill
  textColor: string;
  items: FeatureItem[];
}

interface FAQItem {
  q: string;
  a: string;
}

/* ─── Data ─────────────────────────────────────────────── */

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'chat',
    emoji: '💬',
    title: '对话',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    items: [
      { icon: ChatTeardrop, name: 'Message', desc: '和 char 一对一聊天，支持文字、图片、语音、表情包、转账和戳一戳' },
      { icon: UsersThree, name: '群聊', desc: '多个 char 同时在一个群里聊天，各有各的性格和记忆' },
      { icon: Phone, name: '语音通话', desc: '和 char 打电话，ta 能听见你说话，你也能听见 ta 的声音' },
    ],
  },
  {
    id: 'memory',
    emoji: '🧠',
    title: '记忆与认知',
    color: 'bg-violet-100',
    textColor: 'text-violet-800',
    items: [
      { icon: Brain, name: '神经链接', desc: '角色管理中心——创建 char、编辑设定、管理记忆、挂载世界书' },
      { icon: Sparkle, name: '认知网络', desc: '翻阅 ta 记住的回忆，按时间或情感关联整理成可视化网络' },
      { icon: Globe, name: '世界书', desc: '给 char 补充背景设定，比如「在这个世界里魔法是存在的」' },
      { icon: Path, name: '轨迹', desc: 'ta 的人生时间线——看 ta 来到你身边之前经历了什么' },
    ],
  },
  {
    id: 'life',
    emoji: '📱',
    title: '生活',
    color: 'bg-amber-100',
    textColor: 'text-amber-800',
    items: [
      { icon: BookOpenText, name: '交换日记', desc: '和 char 互写日记，你写一篇 ta 回一篇' },
      { icon: SealCheck, name: '时光契约', desc: '纪念日、日程和约定管理，设定了 ta 会记得' },
      { icon: Heart, name: '见面', desc: '和 char 约见面，选地点、选活动' },
      { icon: Sparkle, name: '约会剧场', desc: '沉浸式约会剧情模式，像玩乙女游戏一样推进故事' },
      { icon: House, name: '小小窝', desc: '和 char 共同生活的小房间，可以装修、放家具、换立绘' },
      { icon: PiggyBank, name: '存钱罐', desc: '和 char 一起攒钱，设立储蓄目标' },
      { icon: Books, name: '自习室', desc: '和 char 一起学习，互相陪伴和监督' },
    ],
  },
  {
    id: 'social',
    emoji: '🌐',
    title: '社交与感知',
    color: 'bg-rose-100',
    textColor: 'text-rose-800',
    items: [
      { icon: Fire, name: 'Spark', desc: 'char 的朋友圈动态，ta 会自己发帖、配图' },
      { icon: TrendUp, name: '实时热搜', desc: '微博热搜榜，char 会根据自己的兴趣刷到不同的热点' },
      { icon: Compass, name: '自由活动', desc: 'char 在小红书上自由浏览、发帖、评论' },
      { icon: Camera, name: '小红书图库', desc: '为 char 的社交动态准备配图素材' },
      { icon: DeviceMobileCamera, name: '查手机', desc: '看看 ta 手机里都有什么（趣味功能）' },
    ],
  },
  {
    id: 'create',
    emoji: '🎨',
    title: '创作与定制',
    color: 'bg-sky-100',
    textColor: 'text-sky-800',
    items: [
      { icon: MusicNote, name: 'Emo Cloud', desc: '音乐播放器——可以播放从你们的回忆里生成的专属歌曲' },
      { icon: Wrench, name: '状态栏工坊', desc: '自定义 char 每条消息下方的状态卡片，可视化编辑器' },
      { icon: PaintBrush, name: '气泡工坊', desc: '自定义聊天气泡样式和配色' },
      { icon: Palette, name: '外观', desc: '壁纸、字体、桌面布局、图标全局定制' },
      { icon: Images, name: '相册', desc: '和 char 之间的图片收藏' },
      { icon: Sparkle, name: '特别时光', desc: '特殊事件和节日的互动纪念功能' },
    ],
  },
  {
    id: 'explore',
    emoji: '🔮',
    title: '探索',
    color: 'bg-purple-100',
    textColor: 'text-purple-800',
    items: [
      { icon: Star, name: '摘星楼', desc: '占卜阁——塔罗牌、星盘、每日运势、命运对话' },
      { icon: GameController, name: 'TRPG', desc: '和 char 一起跑团、玩桌游' },
      { icon: PenNib, name: '笔友会', desc: '和 char 一起写小说、共创故事' },
      { icon: Heartbeat, name: '半糖主义', desc: '饮食管理与健康记录' },
    ],
  },
];

const SYSTEM_ITEMS: FeatureItem[] = [
  { icon: GearSix, name: '设置', desc: 'API 配置、语音合成、语音识别、实时感知引擎、自律代理、备份还原' },
  { icon: Question, name: '使用帮助', desc: '常见问题与故障排除' },
  { icon: Notebook, name: '二改手册', desc: '全部功能的详细使用说明（就在 App 里）' },
  { icon: IdentificationCard, name: '档案', desc: '你自己的个人信息设置' },
];

const FAQ_DATA: FAQItem[] = [
  {
    q: '免费吗？',
    a: '项目本身完全免费开源。对话功能需要自备 API 密钥，有免费额度的选项可以选。',
  },
  {
    q: '数据存在哪？',
    a: '全部存在你自己的浏览器里（IndexedDB），不经过任何第三方服务器。换设备可以用云端备份迁移。',
  },
  {
    q: '手机能用吗？',
    a: '能。用浏览器打开后点「添加到主屏幕」，就跟一个原生 App 一样用，还能收推送通知。',
  },
  {
    q: '需要翻墙吗？',
    a: '取决于你用的 API 服务商。国内有不需要翻墙的选项（比如硅基流动、DeepSeek）。',
  },
  {
    q: '遇到问题找谁？',
    a: '打开桌面上的「使用帮助」App 看 FAQ，或者来群里问。',
  },
];

const STATS = [
  { value: '30+', label: '内置应用' },
  { value: 'PWA', label: '可装到桌面' },
  { value: '本地', label: '数据存储' },
  { value: '免费', label: '开源非商业' },
];

/* ─── Scroll Reveal Hook ───────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const children = el.querySelectorAll('.preview-reveal');
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ─── Sub-Components ───────────────────────────────────── */

function FeatureCard({ item }: { item: FeatureItem }) {
  const Icon = item.icon;
  return (
    <div className="preview-feature-card flex items-start gap-3.5 rounded-2xl border border-[#171215]/8 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#171215]/5">
        <Icon className="h-5 w-5 text-[#171215]/70" weight="bold" />
      </div>
      <div className="min-w-0 pt-0.5">
        <h4 className="text-[15px] font-bold text-[#171215]">{item.name}</h4>
        <p className="mt-1 text-[13px] leading-relaxed text-[#171215]/60">{item.desc}</p>
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: FeatureCategory }) {
  return (
    <div className="preview-reveal">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl">{category.emoji}</span>
        <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${category.color} ${category.textColor}`}>
          {category.title}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {category.items.map((item) => (
          <FeatureCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

function FAQCard({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
      >
        <span className="text-[15px] font-bold text-white/90">{item.q}</span>
        <CaretDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          weight="bold"
        />
      </button>
      {open && (
        <div className="px-5 pb-4 animate-fade-in">
          <p className="text-[13px] leading-relaxed text-white/60">{item.a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────── */

function FeaturePreviewPage({ onEnterApp }: FeaturePreviewPageProps) {
  const containerRef = useScrollReveal();

  return (
    <main className="preview-page min-h-screen bg-[#171215] text-[#fff9f0]" ref={containerRef}>

      {/* ── Hero Section ── */}
      <section className="preview-hero-scene relative overflow-hidden">
        {/* Header Nav */}
        <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.webp" alt="SullyOS" className="h-9 w-9 rounded-2xl" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">手抓糯米机</span>
              <span className="block text-[11px] font-semibold text-white/50">SullyOS 二改版</span>
            </span>
          </div>

          <nav className="hidden items-center gap-1 text-[13px] font-semibold text-white/60 md:flex">
            <button type="button" onClick={() => document.getElementById('guide-features')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full px-3 py-1.5 transition hover:text-white">功能</button>
            <button type="button" onClick={() => document.getElementById('guide-start')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full px-3 py-1.5 transition hover:text-white">上手</button>
            <button type="button" onClick={() => document.getElementById('guide-faq')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full px-3 py-1.5 transition hover:text-white">常见问题</button>
          </nav>

          <button
            type="button"
            onClick={onEnterApp}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-[#171215] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#fff2d0]"
          >
            进入体验
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </button>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-7 sm:pt-20 sm:pb-24">
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            手抓糯米机
            <span className="block text-white/40">SullyOS</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white/65 sm:text-lg">
            一个开源的角色模拟手机系统。
            <br />
            你可以在里面创建 char、聊天、打电话、写日记、听歌、逛小红书——
            <br />
            所有东西都跑在浏览器里，数据存在你自己的设备上。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onEnterApp}
              className="inline-flex items-center gap-2 rounded-full bg-[#fff9f0] px-5 py-3 text-sm font-bold text-[#171215] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ffe7a6]"
            >
              打开 SullyOS
              <ArrowRight className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('guide-features')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white/80 backdrop-blur-xl transition hover:bg-white/15"
            >
              看看都有什么功能
              <CaretDown className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-10 flex flex-wrap gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur">
                <div className="text-base font-black text-white">{s.value}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="guide-features" className="bg-[#fff9f0] px-5 py-14 text-[#171215] sm:px-7">
        <div className="mx-auto max-w-5xl">
          <div className="preview-reveal">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">功能目录</h2>
            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[#171215]/55">
              下面是目前支持的全部功能。桌面上的每个图标都能点进去用。
            </p>
          </div>

          <div className="mt-10 space-y-10">
            {FEATURE_CATEGORIES.map((cat) => (
              <CategorySection key={cat.id} category={cat} />
            ))}

            {/* System category — slightly different style */}
            <div className="preview-reveal">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="text-xl">⚙️</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-bold text-slate-700">
                  系统
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SYSTEM_ITEMS.map((item) => (
                  <FeatureCard key={item.name} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Start Section ── */}
      <section id="guide-start" className="bg-[#f0f7f4] px-5 py-14 text-[#171215] sm:px-7">
        <div className="mx-auto max-w-5xl">
          <div className="preview-reveal">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">快速上手</h2>
            <p className="mt-3 text-[15px] font-medium text-[#171215]/55">
              三步开始用。
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: '打开网页',
                desc: '用手机或电脑浏览器打开链接。想装到桌面的话，浏览器菜单里点「添加到主屏幕」。',
              },
              {
                step: '2',
                title: '配置 API',
                desc: '打开桌面上的「设置」→ API 配置 → 填入地址和密钥。不知道去哪搞？群里问问，或者试试硅基流动的免费额度。',
              },
              {
                step: '3',
                title: '创建 char 开聊',
                desc: '去「神经链接」创建一个 char，填好设定，回到 Message 发一条消息，ta 就在了。',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="preview-reveal preview-feature-card rounded-2xl border border-[#171215]/8 bg-white p-5 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg font-black text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#171215]">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#171215]/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section id="guide-faq" className="bg-[#1d181b] px-5 py-14 sm:px-7">
        <div className="mx-auto max-w-5xl">
          <div className="preview-reveal">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">常见问题</h2>
            <p className="mt-3 text-[15px] font-medium text-white/50">
              新用户经常会问的几个问题。
            </p>
          </div>

          <div className="mt-8 space-y-2">
            {FAQ_DATA.map((item) => (
              <div key={item.q} className="preview-reveal">
                <FAQCard item={item} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <section className="bg-[#171215] px-5 py-10 sm:px-7">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center">
          <img src="/icons/icon-192.webp" alt="SullyOS" className="h-14 w-14 rounded-3xl opacity-80" />
          <p className="text-sm font-medium text-white/40">
            SullyOS · 开源 · 非商业 · PolyForm Noncommercial License
          </p>
          <button
            type="button"
            onClick={onEnterApp}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
          >
            进入体验
            <ArrowRight className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </section>
    </main>
  );
}

export default FeaturePreviewPage;
