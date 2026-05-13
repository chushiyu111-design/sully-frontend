import React from 'react';
import { describe, expect, it } from 'vitest';
import { Icons, INSTALLED_APPS } from '../constants';
import { AppID } from '../types';

describe('LoveShow app registration', () => {
    it('registers LoveShow in launcher metadata with an icon', () => {
        const app = INSTALLED_APPS.find(item => item.id === AppID.LoveShow);

        expect(app).toMatchObject({
            id: AppID.LoveShow,
            name: '恋综',
            icon: 'LoveShow',
            color: 'rose',
        });
        expect(Icons.LoveShow).toBeTypeOf('function');
        expect(React.createElement(Icons.LoveShow, { className: 'test-icon' })).toBeTruthy();
    });
});
