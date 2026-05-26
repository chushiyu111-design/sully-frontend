import { describe, expect, it } from 'vitest';
import { getViewportCssMetrics, isAppleMobileViewport } from '../utils/appViewport';

describe('app viewport css metrics', () => {
  it('uses the visual viewport dimensions when available', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 1280,
      innerHeight: 720,
      visualViewport: {
        width: 430.4,
        height: 800.6,
        offsetTop: 12.2,
        offsetLeft: 0,
      },
      screenHeight: 1080,
      screenAvailHeight: 1040,
      platform: 'Win32',
      userAgent: 'Mozilla/5.0',
      maxTouchPoints: 0,
    });

    expect(metrics.width).toBe(430);
    expect(metrics.height).toBe(801);
    expect(metrics.offsetTop).toBe(12);
    expect(metrics.safeTopFallback).toBe(0);
    expect(metrics.safeBottomFallback).toBe(0);
  });

  it('adds an iOS standalone safe-area fallback when env() is unreliable', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 956,
      visualViewport: {
        width: 440,
        height: 956,
        offsetTop: 0,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(metrics.safeTopFallback).toBe(44);
    expect(metrics.safeBottomFallback).toBe(34);
  });

  it('keeps iOS standalone app height full when the visual viewport only excludes the home indicator', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 956,
      visualViewport: {
        width: 440,
        height: 922,
        offsetTop: 0,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(metrics.height).toBe(956);
    expect(metrics.safeTopFallback).toBe(44);
    expect(metrics.safeBottomFallback).toBe(34);
  });

  it('uses the screen height fallback when iOS reports both layout and visual viewport below fullscreen height', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 922,
      visualViewport: {
        width: 440,
        height: 922,
        offsetTop: 0,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 922,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(metrics.height).toBe(956);
    expect(metrics.safeTopFallback).toBe(44);
    expect(metrics.safeBottomFallback).toBe(34);
  });

  it('does not add the iOS fallback in regular mobile Safari viewport height', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 720,
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: false,
      displayModeStandalone: false,
      displayModeFullscreen: false,
    });

    expect(metrics.safeTopFallback).toBe(0);
    expect(metrics.safeBottomFallback).toBe(0);
  });

  it('keeps keyboard viewport panning separate from safe-area fallback', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 956,
      visualViewport: {
        width: 440,
        height: 420,
        offsetTop: 292,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: false,
      displayModeStandalone: false,
      displayModeFullscreen: false,
    });

    expect(metrics.height).toBe(420);
    expect(metrics.offsetTop).toBe(292);
    expect(metrics.safeTopFallback).toBe(0);
    expect(metrics.safeBottomFallback).toBe(0);
  });

  it('keeps iOS standalone keyboard viewport shrunk instead of expanding behind the keyboard', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 956,
      visualViewport: {
        width: 440,
        height: 420,
        offsetTop: 292,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(metrics.height).toBe(420);
    expect(metrics.offsetTop).toBe(292);
    expect(metrics.safeTopFallback).toBe(44);
    expect(metrics.safeBottomFallback).toBe(34);
  });

  it('keeps iOS standalone keyboard viewport shrunk when innerHeight also follows the keyboard', () => {
    const metrics = getViewportCssMetrics({
      innerWidth: 440,
      innerHeight: 420,
      visualViewport: {
        width: 440,
        height: 420,
        offsetTop: 292,
        offsetLeft: 0,
      },
      screenHeight: 956,
      screenAvailHeight: 956,
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      maxTouchPoints: 5,
      standalone: true,
    });

    expect(metrics.height).toBe(420);
    expect(metrics.offsetTop).toBe(292);
    expect(metrics.safeTopFallback).toBe(44);
    expect(metrics.safeBottomFallback).toBe(34);
  });

  it('treats touch MacIntel as iPadOS', () => {
    expect(isAppleMobileViewport({
      innerWidth: 1024,
      innerHeight: 1366,
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toBe(true);
  });
});
