import { describe, expect, it } from 'vitest';
import {
    LAYERED_STATUS_TEMPLATE_VERSION,
    composeCustomStatusTemplateHtml,
    splitStatusTemplateHtml,
    substituteStatusTemplateVariables,
} from '../utils/statusTemplateComposer';
import type { CustomStatusTemplate } from '../types/statusCard';

describe('statusTemplateComposer', () => {
    it('keeps legacy htmlTemplate behavior as a fallback', () => {
        const template: CustomStatusTemplate = {
            id: 'legacy',
            name: 'Legacy',
            systemPrompt: '',
            extractRegex: '',
            htmlTemplate: '<div>$1|$2|$3</div>',
            renderMode: 'html',
        };
        const match = ['all', 'A', 'B'] as unknown as RegExpMatchArray;

        expect(composeCustomStatusTemplateHtml(template, { matchResult: match, extracted: 'fallback' }))
            .toBe('<div>A|B|</div>');
    });

    it('composes layered HTML, CSS, and opted-in JS into one document', () => {
        const template: CustomStatusTemplate = {
            id: 'layered',
            name: 'Layered',
            systemPrompt: '',
            extractRegex: '',
            htmlBody: '<section class="status-card"><span>$1</span><b>$2</b></section>',
            cssTemplate: '.status-card { color: $2; }',
            jsTemplate: 'document.querySelector(".status-card")?.classList.add("$1");',
            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
            allowScripts: true,
            renderMode: 'html',
        };
        const match = ['all', 'ready', '#fff'] as unknown as RegExpMatchArray;
        const html = composeCustomStatusTemplateHtml(template, { matchResult: match });

        expect(html).toContain('<meta charset="UTF-8">');
        expect(html).toContain('<main class="status-card-frame">');
        expect(html).toContain('<section class="status-card"><span>ready</span><b>#fff</b></section>');
        expect(html).toContain('.status-card { color: #fff; }');
        expect(html).toContain('classList.add("ready")');
    });

    it('omits layered JS when scripts are disabled', () => {
        const template: CustomStatusTemplate = {
            id: 'layered-no-js',
            name: 'Layered',
            systemPrompt: '',
            extractRegex: '',
            htmlBody: '<section>$1</section>',
            jsTemplate: 'document.body.dataset.ready = "yes";',
            templateVersion: LAYERED_STATUS_TEMPLATE_VERSION,
            allowScripts: false,
            renderMode: 'html',
        };

        expect(composeCustomStatusTemplateHtml(template, { previewValues: ['ready'] }))
            .not.toContain('<script>');
    });

    it('substitutes two-digit placeholders without splitting them', () => {
        const match = Array.from({ length: 12 }, (_, index) => (index === 0 ? 'all' : `G${index}`)) as unknown as RegExpMatchArray;

        expect(substituteStatusTemplateVariables('$1|$9|$10|$11|$12', match, 'fallback'))
            .toBe('G1|G9|G10|G11|');
    });

    it('does not leak unresolved placeholders when regex matching fails', () => {
        expect(substituteStatusTemplateVariables('$1|$2|$10', null, 'fallback'))
            .toBe('fallback||');
    });

    it('splits legacy full HTML into layered parts', () => {
        const split = splitStatusTemplateHtml(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>.card{color:red}</style></head><body><div class="card">$1</div><script>document.body.dataset.ready='yes'</script></body></html>`);

        expect(split.htmlBody).toBe('<div class="card">$1</div>');
        expect(split.cssTemplate).toBe('.card{color:red}');
        expect(split.jsTemplate).toBe("document.body.dataset.ready='yes'");
    });
});
