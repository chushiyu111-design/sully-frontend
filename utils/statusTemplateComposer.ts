import type { CustomStatusTemplate } from '../types/statusCard';

export const LAYERED_STATUS_TEMPLATE_VERSION = 2;

type ComposeOptions = {
    matchResult?: RegExpMatchArray | null;
    extracted?: string;
    previewValues?: readonly string[];
    includeScripts?: boolean;
};

export type SplitStatusTemplateResult = {
    htmlBody: string;
    cssTemplate: string;
    jsTemplate: string;
};

const BASE_LAYERED_CSS = `:root {
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: transparent;
}

body {
  width: max-content;
  max-width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Noto Sans SC", sans-serif;
}

.status-card-frame {
  width: 330px;
  max-width: calc(100vw - 24px);
  overflow: hidden;
}

.status-card-frame img,
.status-card-frame svg,
.status-card-frame video {
  max-width: 100%;
}
`;

function normalizeBlock(value: string | undefined): string {
    return (value || '').trim();
}

function stripScriptWrapper(value: string): string {
    return value.replace(/^\s*<script(?:\s[^>]*)?>/i, '').replace(/<\/script>\s*$/i, '').trim();
}

function substituteWithValues(source: string, values: readonly string[], fallback = ''): string {
    return source.replace(/\$(\d+)/g, (token, indexText: string) => {
        const index = Number(indexText);
        if (!Number.isInteger(index) || index <= 0) return token;
        return values[index - 1] ?? (index === 1 ? fallback : token);
    });
}

export function substituteStatusTemplateVariables(
    source: string,
    matchResult: RegExpMatchArray | null,
    extracted = '',
): string {
    if (matchResult && matchResult.length > 1) {
        return source.replace(/\$(\d+)/g, (token, indexText: string) => {
            const index = Number(indexText);
            if (!Number.isInteger(index) || index <= 0 || index >= matchResult.length) {
                return token;
            }

            return matchResult[index] || '';
        });
    }

    return source.replace(/\$(\d+)/g, (token, indexText: string) => (
        indexText === '1' ? extracted : token
    ));
}

export function hasLayeredStatusTemplate(template: CustomStatusTemplate | null | undefined): boolean {
    if (!template) return false;
    return template.templateVersion === LAYERED_STATUS_TEMPLATE_VERSION
        || Boolean(template.htmlBody?.trim())
        || Boolean(template.cssTemplate?.trim())
        || Boolean(template.jsTemplate?.trim());
}

export function composeCustomStatusTemplateHtml(
    template: CustomStatusTemplate,
    options: ComposeOptions = {},
): string {
    if (!hasLayeredStatusTemplate(template)) {
        const legacyHtml = normalizeBlock(template.htmlTemplate);
        if (!legacyHtml) return '';

        return options.previewValues
            ? substituteWithValues(legacyHtml, options.previewValues, options.extracted)
            : substituteStatusTemplateVariables(legacyHtml, options.matchResult || null, options.extracted || '');
    }

    const htmlBody = normalizeBlock(template.htmlBody);
    if (!htmlBody) return '';

    const cssTemplate = normalizeBlock(template.cssTemplate);
    const jsTemplate = stripScriptWrapper(normalizeBlock(template.jsTemplate));
    const shouldIncludeScripts = options.includeScripts ?? template.allowScripts === true;

    const substitutedBody = options.previewValues
        ? substituteWithValues(htmlBody, options.previewValues, options.extracted)
        : substituteStatusTemplateVariables(htmlBody, options.matchResult || null, options.extracted || '');
    const substitutedCss = options.previewValues
        ? substituteWithValues(cssTemplate, options.previewValues, options.extracted)
        : substituteStatusTemplateVariables(cssTemplate, options.matchResult || null, options.extracted || '');
    const substitutedJs = options.previewValues
        ? substituteWithValues(jsTemplate, options.previewValues, options.extracted)
        : substituteStatusTemplateVariables(jsTemplate, options.matchResult || null, options.extracted || '');

    const scriptBlock = shouldIncludeScripts && substitutedJs
        ? `\n<script>\n${substitutedJs}\n</script>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${BASE_LAYERED_CSS}
${substitutedCss}
</style>
</head>
<body>
<main class="status-card-frame">
${substitutedBody}
</main>${scriptBlock}
</body>
</html>`;
}

export function splitStatusTemplateHtml(source: string): SplitStatusTemplateResult {
    const html = source || '';
    const cssParts: string[] = [];
    const jsParts: string[] = [];

    let withoutStyles = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
        if (css.trim()) cssParts.push(css.trim());
        return '';
    });

    withoutStyles = withoutStyles.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs: string, js: string) => {
        if (/\bsrc\s*=/i.test(attrs || '')) return match;
        if (js.trim()) jsParts.push(js.trim());
        return '';
    });

    const bodyMatch = withoutStyles.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodySource = bodyMatch
        ? bodyMatch[1]
        : withoutStyles
            .replace(/<!doctype\b[^>]*>/gi, '')
            .replace(/<html\b[^>]*>|<\/html>/gi, '')
            .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
            .trim();

    return {
        htmlBody: bodySource.trim(),
        cssTemplate: cssParts.join('\n\n').trim(),
        jsTemplate: jsParts.join('\n\n').trim(),
    };
}
