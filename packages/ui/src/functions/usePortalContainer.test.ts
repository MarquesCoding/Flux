import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePortalContainer } from './usePortalContainer';

/**
 * Puts an element into fullscreen the way a browser reports it.
 *
 * jsdom implements neither `requestFullscreen` nor `fullscreenElement`, so
 * the property is defined and the event dispatched by hand. That is faithful
 * to what the hook actually reads — it never calls `requestFullscreen`, it
 * only answers what the document says afterwards.
 */
const enterFullscreen = (element: Element | null) => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: element,
    writable: true,
  });

  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
};

afterEach(() => {
  enterFullscreen(null);
});

describe('usePortalContainer', () => {
  it('asks for no container while nothing is fullscreen', () => {
    const { result } = renderHook(() => usePortalContainer());

    expect(result.current).toBeUndefined();
  });

  it('answers the element that went fullscreen', () => {
    const stage = document.createElement('div');

    document.body.append(stage);

    const { result } = renderHook(() => usePortalContainer());

    enterFullscreen(stage);

    expect(result.current).toBe(stage);
  });

  it('puts popups back when fullscreen is left', () => {
    const stage = document.createElement('div');

    document.body.append(stage);

    const { result } = renderHook(() => usePortalContainer());

    enterFullscreen(stage);
    enterFullscreen(null);

    expect(result.current).toBeUndefined();
  });

  it('follows a change from one fullscreen element to another', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');

    document.body.append(first, second);

    const { result } = renderHook(() => usePortalContainer());

    enterFullscreen(first);
    enterFullscreen(second);

    expect(result.current).toBe(second);
  });

  it('refuses a fullscreen element that cannot host a popup', () => {
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    document.body.append(drawing);

    const { result } = renderHook(() => usePortalContainer());

    enterFullscreen(drawing);

    expect(result.current).toBeUndefined();
  });

  it('stops listening once nothing is using it', () => {
    const stage = document.createElement('div');

    document.body.append(stage);

    const { result, unmount } = renderHook(() => usePortalContainer());

    unmount();
    enterFullscreen(stage);

    expect(result.current).toBeUndefined();
  });
});
