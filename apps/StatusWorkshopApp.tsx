import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useOS } from '../context/OSContext';
import { CustomStatusTemplate, TemplateField } from '../types/statusCard';
import { STATUS_CARD_IFRAME_SHELL } from '../components/chat/statusCardIframe';
import { getSecondaryApiConfig } from '../utils/runtimeConfig';
import {
    LAYERED_STATUS_TEMPLATE_VERSION,
    composeCustomStatusTemplateHtml,
    hasLayeredStatusTemplate,
    splitStatusTemplateHtml,
} from '../utils/statusTemplateComposer';

type TabId = 'prompt' | 'html' | 'css' | 'js';
type GenerationStep = 'protocol' | 'html' | 'css' | 'polish' | 'js';

type GeneratorField = {
    name: string;
    desc: string;
};

type DebouncedPreviewUpdate = ((html: string, allowScripts?: boolean) => void) & {
    cancel: () => void;
};

const DEFAULT_GENERATOR_FIELDS: GeneratorField[] = [
    { name: '时间', desc: '当前时间 HH:MM' },
    { name: '地点', desc: '角色所在位置' },
    { name: '动作', desc: '角色正在做什么' },
];

const GENERATION_LABELS: Record<GenerationStep, string> = {
    protocol: '生成字段 + 正则',
    html: '生成 HTML 骨架',
    css: '生成 CSS',
    polish: '优化 CSS 审美',
    js: '生成互动 JS',
};

const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'prompt', label: '想法 / 字段' },
    { id: 'html', label: 'HTML 骨架' },
    { id: 'css', label: 'CSS 美化' },
    { id: 'js', label: 'JS 互动' },
];

function createEmptyTemplate(index: number): CustomStatusTemplate {
    return {
        id: `tpl_${Date.now()}`,
        name: `方案 ${index + 1}`,
        systemPrompt: '',
        extractRegex: '',
        htmlTemplate: '',
        htmlBody: '',
        cssTemplate: '',
        jsTemplate: '',
        templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
        allowScripts: false,
        renderMode: 'html',
        fields: DEFAULT_GENERATOR_FIELDS.map((field, fieldIndex) => ({
            id: `field_${fieldIndex + 1}`,
            name: field.name,
            description: field.desc,
            required: true,
        })),
    };
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getValidGeneratorFields(fields: GeneratorField[]): GeneratorField[] {
    return fields
        .map(field => ({
            name: field.name.trim(),
            desc: field.desc.trim(),
        }))
        .filter(field => field.name);
}

function toTemplateFields(fields: GeneratorField[]): TemplateField[] {
    return getValidGeneratorFields(fields).map((field, index) => ({
        id: `field_${index + 1}`,
        name: field.name,
        description: field.desc,
        required: true,
    }));
}

function getTemplateFieldList(template: CustomStatusTemplate | null, fallbackFields: GeneratorField[]): TemplateField[] {
    if (template?.fields?.length) return template.fields;
    return toTemplateFields(fallbackFields);
}

function formatFieldList(fields: GeneratorField[] | TemplateField[]): string {
    return fields
        .map((field, index) => {
            const name = 'name' in field ? field.name : '';
            const description = 'desc' in field ? field.desc : field.description;
            return `- ${name}: ${description || `字段 ${index + 1} 的状态值`}（占位符 $${index + 1}）`;
        })
        .join('\n');
}

function extractJsonObject(content: string): any {
    const cleaned = (content || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
        throw new Error('AI 未返回有效 JSON');
    }

    return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeGeneratedFields(fields: any, fallback: GeneratorField[]): TemplateField[] {
    if (!Array.isArray(fields)) return toTemplateFields(fallback);

    const normalized = fields
        .map((field: any, index: number) => ({
            id: `field_${index + 1}`,
            name: String(field?.name || '').trim(),
            description: String(field?.description || field?.desc || '').trim(),
            required: field?.required !== false,
        }))
        .filter((field: TemplateField) => field.name);

    return normalized.length ? normalized : toTemplateFields(fallback);
}

function buildProtocolPrompt(userIdea: string, fields: GeneratorField[]): string {
    return `你是状态栏字段与正则设计师。

用户想做的状态栏：
「${userIdea}」

用户需要展示的字段：
${formatFieldList(fields)}

请只设计角色 AI 的状态输出格式，并生成 extractRegex 正则。不要写视觉，不要写 HTML、CSS、JS。

要求：
- 角色 AI 必须在每次回复末尾输出 <status>...</status>
- 每个字段独占一行
- 字段顺序必须严格等于用户字段顺序
- 字段格式必须是：字段名: 值
- extractRegex 必须捕获每个字段值
- 使用 [\\s\\S]*? 或 \\s* 兼容换行和空白
- systemPrompt 要清楚告诉角色 AI 输出格式，不要让它解释状态栏
- 只输出 JSON，不要 markdown

输出：
{
  "systemPrompt": "给角色 AI 的 system prompt 片段",
  "extractRegex": "用于提取 <status> 块和字段值的正则",
  "fields": [
    { "name": "字段名", "description": "字段说明", "placeholder": "$1" }
  ]
}`;
}

function buildHtmlPrompt(userIdea: string, fields: TemplateField[]): string {
    return `你是状态栏 HTML 结构工程师。

用户想做的状态栏：
「${userIdea}」

字段协议：
${formatFieldList(fields)}

请生成状态栏 body 内部 HTML 骨架。

要求：
- 只生成 body 内部结构，不要输出完整 html/head/body
- 不要写 <style>
- 不要写 <script>
- 必须使用 $1、$2、$3... 作为字段值占位符
- 不要改变字段顺序
- class 名必须语义清楚且稳定，方便 CSS 精修
- 结构要体现信息层级：标题/主状态/字段组/辅助信息
- 宽度按 330px 小卡片设计，但不要在 HTML 上写固定宽度
- 只输出 JSON，不要 markdown

输出：
{
  "htmlBody": "body 内部 HTML",
  "structureNotes": "一句话说明结构"
}`;
}

function buildCssPrompt(userIdea: string, htmlBody: string): string {
    return `你是资深 UI 视觉设计师，不是特效生成器。

用户想做的状态栏：
「${userIdea}」

已有 HTML 结构：
${htmlBody}

你的任务：只写 CSS，把这个状态栏做得精致、清晰、耐看。

设计原则：
- 先服务信息层级，再做装饰
- 视觉必须像一个真实可用的小型状态栏，不像宣传海报
- 宽度以 330px 为基准，自适应移动端
- 字体、间距、圆角、阴影要克制
- 正文文字对比度必须足够，不要低透明度灰字
- 字段值要比字段名更醒目
- 动效只能轻微增强状态感，不能抢内容

严格禁止：
- 不要紫蓝大渐变套娃，除非用户明确要求
- 不要霓虹赛博风，除非用户明确要求
- 不要满屏玻璃拟态和模糊背景
- 不要装饰性光球、blob、bokeh
- 不要过大的圆角、过重阴影、过亮描边
- 不要把所有元素都做成卡片套卡片
- 不要修改 HTML，不要新增字段，不要改 $1/$2 占位符

CSS 要求：
- 只使用已有 class / 标签选择器，可以使用 .status-card-frame
- 可以使用 CSS 变量组织颜色和间距
- 可以使用 transition、transform、@keyframes
- 动画时长 2s-6s，不能闪烁
- 使用 box-sizing: border-box
- 文本必须不会溢出容器
- 适配窄屏，避免横向滚动
- 只输出 JSON，不要 markdown

输出：
{
  "cssTemplate": "只包含 CSS",
  "designIntent": "一句话说明视觉方向",
  "qualityCheck": [
    "信息层级是否清楚",
    "文字是否清晰可读",
    "是否避免廉价渐变和过度装饰"
  ]
}`;
}

function buildCssPolishPrompt(userIdea: string, htmlBody: string, cssTemplate: string): string {
    return `你是 CSS 审美质检和修复专家。

用户想做的状态栏：
「${userIdea}」

HTML 结构：
${htmlBody}

当前 CSS：
${cssTemplate}

请只优化 CSS。目标是去掉明显 AI 味，让视觉更稳、更干净、更耐看。

重点：
- 统一间距、字号、行高和圆角
- 减弱过重阴影、描边、模糊和高饱和装饰
- 提高文字对比度和字段值识别度
- 保留用户明确要求的方向，但不要额外套风格
- 不要修改 HTML，不要新增字段，不要改占位符
- 只输出 JSON，不要 markdown

输出：
{
  "cssTemplate": "优化后的完整 CSS",
  "designIntent": "一句话说明优化结果"
}`;
}

function buildJsPrompt(interactionIdea: string, htmlBody: string, cssTemplate: string): string {
    return `你是状态栏轻互动工程师。

用户想要的互动：
「${interactionIdea}」

已有 HTML：
${htmlBody}

已有 CSS：
${cssTemplate}

请生成少量内联 classic JavaScript。如果用户没有明确互动需求，返回空字符串。

要求：
- 只生成 JS 代码，不要 <script> 标签
- 只能使用 document.querySelector / querySelectorAll / addEventListener
- 只能做点击展开、翻页、切换、翻卡、局部状态变化
- 不要请求网络
- 不要使用 fetch、XMLHttpRequest、WebSocket、localStorage
- 不要使用 alert、confirm、prompt
- 不要使用 onclick 等 HTML 事件属性
- 不要死循环，不要高频 interval
- 不要重写整段 HTML
- 只输出 JSON，不要 markdown

输出：
{
  "jsTemplate": "JS 代码或空字符串",
  "interactionNotes": "一句话说明互动"
}`;
}

const StatusWorkshopApp: React.FC = () => {
    const { closeApp, characters, activeCharacterId, addToast, updateCharacter } = useOS();
    const frameChannel = useId().replace(/:/g, '_');

    const activeChar = useMemo(
        () => characters.find(c => c.id === activeCharacterId),
        [characters, activeCharacterId],
    );

    const [activeTab, setActiveTab] = useState<TabId>('prompt');
    const [templates, setTemplates] = useState<CustomStatusTemplate[]>(() => activeChar?.customStatusTemplates || []);
    const [activeTemplateId, setActiveTemplateId] = useState(
        () => activeChar?.activeCustomTemplateId || activeChar?.customStatusTemplates?.[0]?.id || '',
    );
    const [showGenerator, setShowGenerator] = useState(false);
    const [genDescription, setGenDescription] = useState('');
    const [cssIdea, setCssIdea] = useState('');
    const [interactionIdea, setInteractionIdea] = useState('');
    const [genFields, setGenFields] = useState<GeneratorField[]>(DEFAULT_GENERATOR_FIELDS);
    const [generatingStep, setGeneratingStep] = useState<GenerationStep | null>(null);
    const [previewHeight, setPreviewHeight] = useState(240);
    const [previewReady, setPreviewReady] = useState(false);
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    const previewRef = useRef<HTMLIFrameElement>(null);
    const templateNameInputRef = useRef<HTMLInputElement>(null);
    const systemPromptRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const nextTemplates = activeChar?.customStatusTemplates || [];
        const nextActiveId = activeChar?.activeCustomTemplateId && nextTemplates.some(t => t.id === activeChar.activeCustomTemplateId)
            ? activeChar.activeCustomTemplateId
            : nextTemplates[0]?.id || '';

        setTemplates(nextTemplates);
        setActiveTemplateId(nextActiveId);
    }, [activeChar]);

    const activeTemplate = useMemo(
        () => templates.find(t => t.id === activeTemplateId) || null,
        [templates, activeTemplateId],
    );

    const updateActiveTemplate = useCallback((patch: Partial<CustomStatusTemplate>) => {
        if (!activeTemplateId) return;
        setTemplates(prev => prev.map(template => (
            template.id === activeTemplateId
                ? { ...template, ...patch }
                : template
        )));
    }, [activeTemplateId]);

    const handleCreateTemplate = useCallback(() => {
        const nextTemplate = createEmptyTemplate(templates.length);
        setTemplates(prev => [...prev, nextTemplate]);
        setActiveTemplateId(nextTemplate.id);
        setActiveTab('prompt');
        setShowGenerator(true);
    }, [templates.length]);

    const handleCopyTemplate = useCallback(() => {
        if (!activeTemplate) {
            addToast('请先选择一个方案', 'error');
            return;
        }

        const copiedTemplate: CustomStatusTemplate = {
            ...activeTemplate,
            id: `tpl_${Date.now()}`,
            name: `${activeTemplate.name || '未命名方案'} 副本`,
        };

        setTemplates(prev => [...prev, copiedTemplate]);
        setActiveTemplateId(copiedTemplate.id);
        setActiveTab('prompt');
    }, [activeTemplate, addToast]);

    const handleDeleteTemplate = useCallback((templateId: string) => {
        setTemplates(prev => {
            const currentIndex = prev.findIndex(template => template.id === templateId);
            const next = prev.filter(template => template.id !== templateId);

            if (templateId === activeTemplateId) {
                const fallback = next[currentIndex] || next[currentIndex - 1] || next[0];
                setActiveTemplateId(fallback?.id || '');
            }

            return next;
        });
    }, [activeTemplateId]);

    const handleEditCurrentTemplate = useCallback(() => {
        if (!activeTemplate) {
            addToast('请先选择一个方案', 'error');
            return;
        }

        setActiveTab('prompt');

        window.setTimeout(() => {
            if (!activeTemplate.name.trim()) {
                templateNameInputRef.current?.focus();
                return;
            }

            systemPromptRef.current?.focus();
        }, 0);
    }, [activeTemplate, addToast]);

    const buildPreviewHtml = useCallback((template: CustomStatusTemplate | null) => {
        if (!template) {
            return `<div style="width:330px;max-width:100%;min-height:200px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);box-sizing:border-box;padding:24px;color:rgba(255,255,255,0.72);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC',sans-serif;"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.38;">Status Workshop</div><div style="margin-top:16px;font-size:18px;font-weight:600;">新建一个方案开始编辑</div><div style="margin-top:10px;font-size:13px;line-height:1.7;opacity:0.58;">分层编辑 HTML、CSS 和可选 JS，预览会实时更新。</div></div>`;
        }

        const previewFields = getTemplateFieldList(template, genFields);

        if (template.renderMode === 'text') {
            const lines = previewFields.map((field, index) => `${field.name}: [字段${index + 1}]`);
            const textPreview = lines.length > 0
                ? lines.join('\n')
                : '字段1: [字段1]\n字段2: [字段2]\n字段3: [字段3]';

            return `<div style="width:330px;max-width:100%;min-height:200px;border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04));border:1px solid rgba(255,255,255,0.08);box-sizing:border-box;padding:22px;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC',sans-serif;box-shadow:0 18px 40px rgba(0,0,0,0.28);"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><div style="font-size:15px;font-weight:600;">文本模式预览</div><div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.48;">Text</div></div><pre style="margin:18px 0 0;white-space:pre-wrap;font:500 13px/1.8 'SF Mono','Fira Code',monospace;color:rgba(236,253,245,0.88);">${escapeHtml(textPreview)}</pre></div>`;
        }

        if (!hasLayeredStatusTemplate(template) && !template.htmlTemplate?.trim()) {
            return `<div style="width:330px;max-width:100%;min-height:200px;border-radius:24px;border:1px dashed rgba(255,255,255,0.12);background:rgba(13,13,26,0.86);box-sizing:border-box;padding:24px;color:rgba(255,255,255,0.58);font-family:'SF Mono','Fira Code',monospace;"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.38;">Layered Template</div><div style="margin-top:16px;font-size:13px;line-height:1.8;">先生成协议，再生成 HTML 骨架和 CSS。这里会用 [字段1]、[字段2]… 替换占位符。</div></div>`;
        }

        const previewValues = previewFields.length > 0
            ? previewFields.map((field, index) => `[${field.name || `字段${index + 1}`}]`)
            : ['[字段1]', '[字段2]', '[字段3]'];

        const composedHtml = composeCustomStatusTemplateHtml(template, {
            previewValues,
            includeScripts: template.allowScripts === true,
        });

        return composedHtml || `<div style="width:330px;max-width:100%;min-height:200px;border-radius:24px;border:1px dashed rgba(255,255,255,0.12);background:rgba(13,13,26,0.86);box-sizing:border-box;padding:24px;color:rgba(255,255,255,0.58);font-family:'SF Mono','Fira Code',monospace;">HTML 骨架还是空的。</div>`;
    }, [genFields]);

    const debouncedUpdate = useMemo<DebouncedPreviewUpdate>(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;

        const send = ((html: string, allowScripts = false) => {
            if (timer) clearTimeout(timer);

            timer = setTimeout(() => {
                previewRef.current?.contentWindow?.postMessage(
                    { type: 'preview-update', channel: frameChannel, html, allowScripts },
                    '*',
                );
            }, 200);
        }) as DebouncedPreviewUpdate;

        send.cancel = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        return send;
    }, [frameChannel]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<{ type?: string; channel?: string; height?: number }>) => {
            if (event.source !== previewRef.current?.contentWindow) return;
            if (event.data?.type !== 'preview-height') return;
            if (event.data.channel !== frameChannel) return;

            const nextHeight = typeof event.data.height === 'number'
                ? Math.max(event.data.height + 16, 220)
                : 240;

            setPreviewHeight(nextHeight);
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [frameChannel]);

    useEffect(() => {
        if (!previewReady) return;
        debouncedUpdate(
            buildPreviewHtml(activeTemplate),
            activeTemplate?.renderMode === 'html' && activeTemplate.allowScripts === true,
        );
    }, [activeTemplate, buildPreviewHtml, debouncedUpdate, previewReady]);

    useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

    const callSecondaryJson = useCallback(async (prompt: string, temperature: number) => {
        const config = getSecondaryApiConfig();
        if (!config?.apiKey) {
            throw new Error('请先在全局设置中配置副 API');
        }

        const baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                temperature,
                stream: false,
            }),
        });

        const raw = await res.text();
        let data: any = {};

        try {
            data = raw ? JSON.parse(raw) : {};
        } catch {
            throw new Error(raw || `副 API 返回了无效响应 (${res.status})`);
        }

        if (!res.ok) {
            throw new Error(data?.error?.message || data?.message || `生成失败 (${res.status})`);
        }

        const content = data.choices?.[0]?.message?.content || '';
        return extractJsonObject(content);
    }, []);

    const resolveTargetTemplate = useCallback(() => {
        let targetTemplate = activeTemplate;
        let targetTemplateId = activeTemplateId;

        if (!targetTemplate) {
            targetTemplate = createEmptyTemplate(templates.length);
            targetTemplateId = targetTemplate.id;
            setActiveTemplateId(targetTemplate.id);
            setTemplates(prev => (
                prev.some(template => template.id === targetTemplate!.id)
                    ? prev
                    : [...prev, targetTemplate!]
            ));
        }

        return { targetTemplate, targetTemplateId };
    }, [activeTemplate, activeTemplateId, templates.length]);

    const handleGenerateStep = useCallback(async (step: GenerationStep) => {
        const userIdea = genDescription.trim();
        const visualIdea = cssIdea.trim()
            ? `${userIdea}\n\nCSS 视觉想法：${cssIdea.trim()}`
            : userIdea;
        const validFields = getValidGeneratorFields(genFields);

        if ((step === 'protocol' || step === 'html') && userIdea.length < 4) {
            addToast('先把想要的状态栏说清楚一点，再生成', 'error');
            return;
        }

        if ((step === 'protocol' || step === 'html') && validFields.length === 0) {
            addToast('请至少填写一个字段', 'error');
            return;
        }

        const { targetTemplate, targetTemplateId } = resolveTargetTemplate();
        if (!targetTemplate || !targetTemplateId) return;

        const templateFields = getTemplateFieldList(targetTemplate, validFields);

        if ((step === 'css' || step === 'polish' || step === 'js') && !targetTemplate.htmlBody?.trim()) {
            addToast('先生成或填写 HTML 骨架', 'error');
            setActiveTab('html');
            return;
        }

        if (step === 'polish' && !targetTemplate.cssTemplate?.trim()) {
            addToast('先生成或填写 CSS，再优化审美', 'error');
            setActiveTab('css');
            return;
        }

        setGeneratingStep(step);

        try {
            let prompt = '';
            let temperature = 0.6;

            if (step === 'protocol') {
                prompt = buildProtocolPrompt(userIdea, validFields);
                temperature = 0.35;
            } else if (step === 'html') {
                prompt = buildHtmlPrompt(userIdea, templateFields);
                temperature = 0.55;
            } else if (step === 'css') {
                prompt = buildCssPrompt(visualIdea, targetTemplate.htmlBody || '');
                temperature = 0.72;
            } else if (step === 'polish') {
                prompt = buildCssPolishPrompt(visualIdea, targetTemplate.htmlBody || '', targetTemplate.cssTemplate || '');
                temperature = 0.45;
            } else {
                prompt = buildJsPrompt(interactionIdea.trim(), targetTemplate.htmlBody || '', targetTemplate.cssTemplate || '');
                temperature = 0.4;
            }

            const result = await callSecondaryJson(prompt, temperature);

            setTemplates(prev => {
                const base = prev.some(template => template.id === targetTemplateId)
                    ? prev
                    : [...prev, targetTemplate];

                return base.map(template => {
                    if (template.id !== targetTemplateId) return template;

                    if (step === 'protocol') {
                        return {
                            ...template,
                            systemPrompt: result.systemPrompt || template.systemPrompt,
                            extractRegex: result.extractRegex || template.extractRegex,
                            fields: normalizeGeneratedFields(result.fields, validFields),
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                            renderMode: 'html',
                        };
                    }

                    if (step === 'html') {
                        return {
                            ...template,
                            htmlBody: result.htmlBody || template.htmlBody,
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                            renderMode: 'html',
                        };
                    }

                    if (step === 'css' || step === 'polish') {
                        return {
                            ...template,
                            cssTemplate: result.cssTemplate || template.cssTemplate,
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                            renderMode: 'html',
                        };
                    }

                    return {
                        ...template,
                        jsTemplate: typeof result.jsTemplate === 'string' ? result.jsTemplate : template.jsTemplate,
                        allowScripts: Boolean(result.jsTemplate?.trim()) || template.allowScripts === true,
                        templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                        renderMode: 'html',
                    };
                });
            });

            if (step === 'html') setActiveTab('html');
            if (step === 'css' || step === 'polish') setActiveTab('css');
            if (step === 'js') setActiveTab('js');

            addToast(`${GENERATION_LABELS[step]}完成`, 'success');
        } catch (e: any) {
            addToast(`${GENERATION_LABELS[step]}失败: ${e.message || ''}`, 'error');
        } finally {
            setGeneratingStep(null);
        }
    }, [activeTemplate, addToast, callSecondaryJson, cssIdea, genDescription, genFields, interactionIdea, resolveTargetTemplate]);

    const handleSplitLegacyTemplate = useCallback(() => {
        if (!activeTemplate?.htmlTemplate?.trim()) {
            addToast('当前方案没有旧版完整 HTML 可拆分', 'error');
            return;
        }

        const split = splitStatusTemplateHtml(activeTemplate.htmlTemplate);
        if (!split.htmlBody.trim()) {
            addToast('拆分失败：没有识别到 body 内容', 'error');
            return;
        }

        updateActiveTemplate({
            htmlBody: split.htmlBody,
            cssTemplate: split.cssTemplate,
            jsTemplate: split.jsTemplate,
            allowScripts: split.jsTemplate.trim() ? activeTemplate.allowScripts === true : activeTemplate.allowScripts,
            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
            renderMode: 'html',
        });
        setActiveTab('html');
        addToast('已拆成 HTML / CSS / JS，可继续微调', 'success');
    }, [activeTemplate, addToast, updateActiveTemplate]);

    const handleSave = async () => {
        if (!activeChar) {
            addToast('请先选择一个角色', 'error');
            return;
        }

        const selectedTemplateId = activeTemplateId || templates[0]?.id;

        try {
            await updateCharacter(activeChar.id, {
                customStatusTemplates: templates,
                activeCustomTemplateId: selectedTemplateId,
                statusBarMode: 'custom',
            });
            addToast('模板已保存', 'success');
        } catch (e: any) {
            addToast('保存失败: ' + (e.message || ''), 'error');
        }
    };

    const renderEmptyState = (message: string) => (
        <div className="animate-fade-in rounded-[28px] border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm p-6 text-white/60">
            <div className="text-[13px] font-semibold text-white/80">还没有方案</div>
            <p className="mt-2 text-[12px] leading-6 text-white/40">{message}</p>
            <button
                onClick={handleCreateTemplate}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.08] px-4 py-2.5 text-[12px] font-semibold text-white/80 transition-all hover:bg-white/10 active:scale-[0.98]"
            >
                <span className="text-base leading-none">+</span>
                新建方案
            </button>
        </div>
    );

    const renderStepButton = (step: GenerationStep, extraClass = '') => (
        <button
            onClick={() => handleGenerateStep(step)}
            disabled={generatingStep !== null}
            className={`rounded-2xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                generatingStep === step
                    ? 'cursor-wait bg-white/[0.05] text-white/35'
                    : generatingStep
                        ? 'cursor-not-allowed bg-white/[0.03] text-white/22'
                        : 'bg-white/[0.10] text-white/82 hover:bg-white/[0.14] active:scale-[0.98]'
            } ${extraClass}`}
        >
            {generatingStep === step ? '生成中...' : GENERATION_LABELS[step]}
        </button>
    );

    const renderPromptTab = () => {
        if (!activeTemplate) {
            return renderEmptyState('先新建一个方案，再填写想法、字段、system prompt 和提取正则。');
        }

        return (
            <div className="space-y-4 animate-fade-in">
                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm">
                    <button
                        onClick={() => setShowGenerator(prev => !prev)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:items-center sm:px-5"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-white/80">想法驱动生成</div>
                            <p className="mt-1 text-[11px] leading-5 text-white/30">不套风格预设。先定字段和正则，再生成 HTML 骨架、CSS 和轻互动。</p>
                        </div>
                        <div className={`mt-1 shrink-0 text-white/40 transition-transform sm:mt-0 ${showGenerator ? 'rotate-180' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                        </div>
                    </button>

                    {showGenerator && (
                        <div className="space-y-4 border-t border-white/[0.05] px-4 pb-5 pt-4 sm:px-5">
                            <div>
                                <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/45">状态栏想法</label>
                                <textarea
                                    value={genDescription}
                                    onChange={e => setGenDescription(e.target.value)}
                                    placeholder="说清楚你想做什么：像什么物件、展示哪些信息、整体情绪、哪些元素不要。描述太空泛就不会替你套模板。"
                                    className="h-28 w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[12px] leading-6 text-white/80 outline-none transition-colors placeholder:text-white/20 focus:border-white/15"
                                />
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="text-[11px] font-semibold tracking-wide text-white/45">字段列表</label>
                                    <button
                                        onClick={() => setGenFields(prev => [...prev, { name: '', desc: '' }])}
                                        className="rounded-xl border border-white/[0.05] bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/60 transition-all hover:bg-white/[0.08]"
                                    >
                                        + 添加字段
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {genFields.map((field, index) => (
                                        <div
                                            key={`${index}-${field.name}`}
                                            className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-2.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                                        >
                                            <div className="grid grid-cols-[minmax(0,1fr),40px] gap-2 sm:grid-cols-[108px,minmax(0,1fr),40px]">
                                                <input
                                                    value={field.name}
                                                    onChange={e => setGenFields(prev => prev.map((item, itemIndex) => (
                                                        itemIndex === index ? { ...item, name: e.target.value } : item
                                                    )))}
                                                    placeholder="字段名"
                                                    className="min-w-0 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white/75 outline-none transition-colors placeholder:text-white/20 focus:border-white/15"
                                                />
                                                <button
                                                    onClick={() => setGenFields(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                                                    disabled={genFields.length === 1}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-[12px] transition-all sm:order-3 ${
                                                        genFields.length === 1
                                                            ? 'cursor-not-allowed border-white/[0.04] bg-white/[0.03] text-white/15'
                                                            : 'border-white/[0.05] bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'
                                                    }`}
                                                >
                                                    x
                                                </button>
                                                <input
                                                    value={field.desc}
                                                    onChange={e => setGenFields(prev => prev.map((item, itemIndex) => (
                                                        itemIndex === index ? { ...item, desc: e.target.value } : item
                                                    )))}
                                                    placeholder="字段说明"
                                                    className="col-span-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 text-[12px] text-white/75 outline-none transition-colors placeholder:text-white/20 focus:border-white/15 sm:order-2 sm:col-span-1"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/[0.04] bg-[#0d0d1a] px-4 py-3 text-[11px] leading-6 text-white/35">
                                推荐顺序：先填字段，点“生成字段 + 正则”；正则负责从 &lt;status&gt; 里抓值。再生成 HTML 骨架，最后生成 CSS。觉得 AI 味重就点“优化 CSS 审美”。
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {renderStepButton('protocol')}
                                {renderStepButton('html')}
                                {renderStepButton('css')}
                                {renderStepButton('polish')}
                                {renderStepButton('js')}
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <label className="mb-3 block text-[11px] font-semibold tracking-wide text-white/45">System Prompt</label>
                    <textarea
                        ref={systemPromptRef}
                        value={activeTemplate.systemPrompt}
                        onChange={e => updateActiveTemplate({ systemPrompt: e.target.value })}
                        placeholder="告诉角色 AI 应该如何在回复末尾输出 <status>...</status> 结构化数据。"
                        className="h-48 w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-4 text-[12px] leading-6 text-white/80 outline-none transition-colors placeholder:text-white/18 focus:border-white/15 sm:h-56"
                        spellCheck={false}
                    />
                    <p className="mt-3 text-[11px] leading-6 text-white/28">这一步只负责让角色在回复末尾输出固定字段；下面的正则会把字段值抓成 $1、$2、$3。</p>
                </div>

                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <label className="mb-3 block text-[11px] font-semibold tracking-wide text-white/45">提取正则</label>
                    <textarea
                        value={activeTemplate.extractRegex}
                        onChange={e => updateActiveTemplate({ extractRegex: e.target.value })}
                        placeholder="<status>\\s*时间:\\s*(.*?)\\s*地点:\\s*(.*?)\\s*动作:\\s*(.*?)\\s*<\\/status>"
                        className="h-24 w-full resize-none rounded-2xl border border-white/[0.05] bg-[#0d0d1a] px-4 py-4 font-mono text-[12px] leading-6 text-emerald-300/60 outline-none transition-colors placeholder:text-white/15 focus:border-white/15 sm:h-28"
                        spellCheck={false}
                    />
                    <p className="mt-3 text-[11px] leading-6 text-white/28">正则匹配成功后，第 1 个捕获组就是 $1，第 2 个捕获组就是 $2，会按顺序填进 HTML 骨架。</p>
                </div>

                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <div className="mb-3 text-[11px] font-semibold tracking-wide text-white/45">渲染模式</div>
                    <div className="grid grid-cols-2 gap-2">
                        {(['html', 'text'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => updateActiveTemplate({ renderMode: mode })}
                                className={`rounded-2xl border px-4 py-3 text-[12px] font-semibold transition-all ${
                                    activeTemplate.renderMode === mode
                                        ? 'bg-white/10 border-white/15 text-white/80'
                                        : 'bg-white/[0.03] border-white/[0.05] text-white/38 hover:bg-white/[0.06]'
                                }`}
                            >
                                {mode === 'html' ? 'HTML 卡片' : '文本卡片'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderHtmlTab = () => {
        if (!activeTemplate) {
            return renderEmptyState('先创建一个方案，再开始编写 HTML 骨架。');
        }

        return (
            <div className="space-y-4 animate-fade-in">
                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="text-[11px] font-semibold tracking-wide text-white/45">HTML 骨架</div>
                        <div className="text-[10px] leading-4 text-white/25">$1, $2, $3 会按正则捕获组顺序替换</div>
                    </div>
                    <textarea
                        value={activeTemplate.htmlBody || ''}
                        onChange={e => updateActiveTemplate({
                            htmlBody: e.target.value,
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                        })}
                        placeholder="<section class=&quot;status-card&quot;>...</section>"
                        className="h-[42svh] min-h-[280px] w-full resize-none rounded-2xl border border-white/[0.05] bg-[#0d0d1a] px-4 py-4 font-mono text-[12px] leading-6 text-emerald-300/60 outline-none transition-colors placeholder:text-white/15 focus:border-white/15 sm:h-[440px] sm:min-h-0"
                        spellCheck={false}
                    />
                </div>

                {activeTemplate.htmlTemplate?.trim() && (
                    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.03] p-4 text-[11px] leading-6 text-white/34">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>检测到旧版完整 HTML。可以一键拆成 HTML / CSS / JS；旧内容会继续保留作为兼容备份。</div>
                            <button
                                onClick={handleSplitLegacyTemplate}
                                className="min-h-[40px] rounded-2xl border border-white/[0.06] bg-white/[0.07] px-4 py-2 text-[12px] font-semibold text-white/72 transition-all hover:bg-white/[0.10] active:scale-[0.98]"
                            >
                                拆分旧模板
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCssTab = () => {
        if (!activeTemplate) {
            return renderEmptyState('先创建一个方案，再开始编写 CSS。');
        }

        return (
            <div className="space-y-4 animate-fade-in">
                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div>
                            <div className="text-[11px] font-semibold tracking-wide text-white/45">CSS 美化</div>
                            <p className="mt-1 text-[10px] leading-4 text-white/25">只写内联 CSS，不改 HTML 结构。动效优先用 transition / @keyframes。</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {renderStepButton('css')}
                            {renderStepButton('polish')}
                        </div>
                    </div>
                    <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/45">CSS 视觉想法</label>
                    <textarea
                        value={cssIdea}
                        onChange={e => setCssIdea(e.target.value)}
                        placeholder={'视觉方向（可选）：比如更像杂志内页、极简主义、字段值更醒目。这里会影响「生成 CSS」和「优化 CSS 审美」。'}
                        className="mb-4 h-24 w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[12px] leading-6 text-white/80 outline-none transition-colors placeholder:text-white/20 focus:border-white/15"
                    />
                    <textarea
                        value={activeTemplate.cssTemplate || ''}
                        onChange={e => updateActiveTemplate({
                            cssTemplate: e.target.value,
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                        })}
                        placeholder=".status-card { ... }"
                        className="h-[48svh] min-h-[320px] w-full resize-none rounded-2xl border border-white/[0.05] bg-[#0d0d1a] px-4 py-4 font-mono text-[12px] leading-6 text-sky-200/70 outline-none transition-colors placeholder:text-white/15 focus:border-white/15 sm:h-[500px] sm:min-h-0"
                        spellCheck={false}
                    />
                </div>

                <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[11px] leading-6 text-white/32">
                    CSS 质量闸门：稳间距、清晰文字、克制阴影。不要光球、blob、廉价渐变和卡片套卡片。
                </div>
            </div>
        );
    };

    const renderJsTab = () => {
        if (!activeTemplate) {
            return renderEmptyState('先创建一个方案，再添加可选互动。');
        }

        return (
            <div className="space-y-4 animate-fade-in">
                <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-5 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3">
                        <div className="min-w-0 flex-1 pr-2">
                            <div className="text-[12px] font-semibold text-white/70">启用脚本</div>
                            <div className="mt-1 text-[10px] leading-4 text-white/28">只运行内联 classic script；外链、网络请求和弹窗会被拦截。</div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={activeTemplate.allowScripts === true}
                            onClick={() => updateActiveTemplate({ allowScripts: activeTemplate.allowScripts !== true })}
                            className={`relative flex h-8 w-14 flex-none items-center rounded-full p-1 transition-colors ${
                                activeTemplate.allowScripts === true ? 'bg-emerald-400/70' : 'bg-white/[0.12]'
                            }`}
                        >
                            <span
                                className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                                    activeTemplate.allowScripts === true ? 'translate-x-6' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    <label className="mb-2 block text-[11px] font-semibold tracking-wide text-white/45">互动想法</label>
                    <textarea
                        value={interactionIdea}
                        onChange={e => setInteractionIdea(e.target.value)}
                        placeholder="比如：点击展开第二页、点击按钮切换心情、点卡片翻面。如果没有明确互动需求，保持为空。"
                        className="mb-4 h-24 w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[12px] leading-6 text-white/80 outline-none transition-colors placeholder:text-white/20 focus:border-white/15"
                    />

                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="text-[11px] font-semibold tracking-wide text-white/45">JS 互动代码</div>
                        {renderStepButton('js')}
                    </div>
                    <textarea
                        value={activeTemplate.jsTemplate || ''}
                        onChange={e => updateActiveTemplate({
                            jsTemplate: e.target.value,
                            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
                        })}
                        placeholder="document.querySelector('.status-card')?.addEventListener('click', () => { ... });"
                        className="h-[34svh] min-h-[240px] w-full resize-none rounded-2xl border border-white/[0.05] bg-[#0d0d1a] px-4 py-4 font-mono text-[12px] leading-6 text-amber-200/70 outline-none transition-colors placeholder:text-white/15 focus:border-white/15 sm:h-[360px] sm:min-h-0"
                        spellCheck={false}
                    />
                </div>

                <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[11px] leading-6 text-white/32">
                    允许：addEventListener、classList、局部展开/翻页/翻卡。禁止：fetch、XMLHttpRequest、WebSocket、localStorage、onclick、alert、死循环。
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex h-full w-full flex-col overflow-x-hidden overflow-y-auto bg-[#0a0a14] text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 right-[-56px] h-64 w-64 rounded-full bg-sky-500/[0.08] blur-[90px]" />
                <div className="absolute bottom-[-90px] left-[-70px] h-72 w-72 rounded-full bg-emerald-500/[0.05] blur-[110px]" />
            </div>

            <div className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-3 sm:px-5 sm:pt-4">
                <button
                    onClick={closeApp}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.06] backdrop-blur-sm transition-all hover:bg-white/10 active:scale-90"
                    aria-label="返回"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-white/70">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>

                <div className="min-w-0 flex-1 px-1 text-center">
                    <h1 className="text-[15px] font-semibold tracking-wide text-white/90">状态栏工坊</h1>
                    <p className="mt-0.5 truncate text-[10px] text-white/30">
                        {activeChar ? `为 ${activeChar.name} 管理多套方案` : '请先选择角色'}
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    className="min-h-[42px] shrink-0 rounded-full border border-white/[0.06] bg-white/[0.08] px-4 py-2 text-[12px] font-semibold text-white/80 transition-all hover:bg-white/12 active:scale-95"
                >
                    保存
                </button>
            </div>

            <div className="relative z-10 px-4 pb-3 sm:pb-4">
                <div className="rounded-[30px] border border-white/[0.06] bg-white/[0.04] p-4 backdrop-blur-sm">
                    <div className="overflow-x-auto pb-1">
                        <div className="flex min-w-max gap-2">
                            {templates.map(template => {
                                const isActive = template.id === activeTemplateId;
                                return (
                                    <div
                                        key={template.id}
                                        className={`flex items-center gap-1 rounded-2xl border px-2 py-1 ${
                                            isActive
                                                ? 'bg-white/10 border-white/15 text-white/80'
                                                : 'bg-white/[0.04] border-white/[0.05] text-white/45'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setActiveTemplateId(template.id)}
                                            className="rounded-xl px-2 py-1 text-[12px] font-medium transition-opacity hover:opacity-100"
                                        >
                                            {template.name || '未命名方案'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="flex h-6 w-6 items-center justify-center rounded-lg text-[14px] text-white/35 transition-all hover:bg-white/[0.08] hover:text-white/70"
                                            title="删除方案"
                                        >
                                            x
                                        </button>
                                    </div>
                                );
                            })}

                            {templates.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-2 text-[12px] text-white/28">
                                    还没有任何方案
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            onClick={handleCreateTemplate}
                            className="min-h-[42px] flex-1 rounded-2xl border border-white/[0.05] bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white/75 transition-all hover:bg-white/10 active:scale-[0.98] sm:flex-none"
                        >
                            + 新建方案
                        </button>
                        <button
                            onClick={handleEditCurrentTemplate}
                            disabled={!activeTemplate}
                            className={`min-h-[42px] flex-1 rounded-2xl border px-3 py-2 text-[12px] font-semibold transition-all sm:flex-none ${
                                activeTemplate
                                    ? 'border-white/[0.05] bg-white/[0.05] text-white/75 hover:bg-white/10 active:scale-[0.98]'
                                    : 'cursor-not-allowed border-white/[0.04] bg-white/[0.03] text-white/20'
                            }`}
                        >
                            编辑当前方案
                        </button>
                        <button
                            onClick={handleCopyTemplate}
                            disabled={!activeTemplate}
                            className={`min-h-[42px] flex-1 rounded-2xl border px-3 py-2 text-[12px] font-semibold transition-all sm:flex-none ${
                                activeTemplate
                                    ? 'border-white/[0.05] bg-white/[0.04] text-white/65 hover:bg-white/[0.08] active:scale-[0.98]'
                                    : 'cursor-not-allowed border-white/[0.04] bg-white/[0.03] text-white/20'
                            }`}
                        >
                            复制当前方案
                        </button>
                    </div>

                    {activeTemplate && (
                        <div className="mt-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="block text-[11px] font-semibold tracking-wide text-white/40">方案名称</label>
                                <span className="truncate text-[10px] text-white/28">
                                    当前编辑: {activeTemplate.name || '未命名方案'}
                                </span>
                            </div>
                            <input
                                ref={templateNameInputRef}
                                value={activeTemplate.name}
                                onChange={e => updateActiveTemplate({ name: e.target.value })}
                                placeholder="给当前方案起个名字"
                                className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[13px] text-white/80 outline-none transition-colors placeholder:text-white/18 focus:border-white/15"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="relative z-10 flex flex-col gap-4 px-4 pb-24 sm:pb-4 lg:min-h-0 lg:flex-1 lg:flex-row">
                <div className="lg:order-2 lg:min-w-[360px] lg:max-w-[480px] lg:flex-1">
                    <div className="rounded-[32px] border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-white/80">实时预览</div>
                                <p className="mt-1 text-[11px] text-white/28">预览和聊天渲染共用同一套 HTML 组装逻辑。</p>
                            </div>
                            <button
                                onClick={() => setShowMobilePreview(prev => !prev)}
                                className="min-h-[42px] shrink-0 rounded-full border border-white/[0.05] bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-white/65 transition-all hover:bg-white/[0.09] active:scale-[0.98] lg:hidden"
                                aria-expanded={showMobilePreview}
                            >
                                {showMobilePreview ? '收起预览' : '展开预览'}
                            </button>
                            <div className="hidden rounded-full border border-white/[0.05] bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/30 lg:block">
                                preview
                            </div>
                        </div>

                        <div
                            className={`transition-all duration-300 ${
                                showMobilePreview
                                    ? 'mt-3 max-h-[960px] opacity-100'
                                    : 'max-h-0 opacity-0 pointer-events-none'
                            } lg:mt-3 lg:max-h-none lg:opacity-100 lg:pointer-events-auto`}
                        >
                            <div className="flex min-h-[200px] items-center justify-center rounded-[28px] border border-white/[0.05] bg-[#06060d] px-3 py-5 sm:min-h-[220px]">
                                <iframe
                                    ref={previewRef}
                                    srcDoc={STATUS_CARD_IFRAME_SHELL}
                                    sandbox="allow-scripts"
                                    title="状态栏预览"
                                    className="w-full rounded-[24px] border-0 bg-transparent"
                                    style={{ height: `${previewHeight}px` }}
                                    onLoad={() => setPreviewReady(true)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 lg:order-1 lg:min-h-0 lg:flex-1 lg:rounded-[32px] lg:border lg:border-white/[0.06] lg:bg-white/[0.03] lg:p-4 lg:backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-2 rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-2 backdrop-blur-sm lg:mb-0 lg:flex lg:flex-wrap lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`min-h-[44px] min-w-0 rounded-[20px] px-3 py-2.5 text-[12px] font-semibold transition-all lg:flex-1 xl:flex-none xl:px-4 ${
                                    activeTab === tab.id
                                        ? 'bg-white/10 border border-white/15 text-white/80'
                                        : 'bg-white/[0.03] text-white/35 hover:bg-white/[0.06]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-0 flex-1 pb-3 sm:pb-4 lg:pr-1">
                        {activeTab === 'prompt' && renderPromptTab()}
                        {activeTab === 'html' && renderHtmlTab()}
                        {activeTab === 'css' && renderCssTab()}
                        {activeTab === 'js' && renderJsTab()}
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/15 shadow-lg shadow-black/40 backdrop-blur-xl transition-all active:scale-90 sm:hidden"
                aria-label="保存"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-white/90">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
            </button>
        </div>
    );
};

export default StatusWorkshopApp;
