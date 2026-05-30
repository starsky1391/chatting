import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

type UseVirtualMessageWindowOptions<T> = {
  items: T[];
  containerRef: RefObject<HTMLDivElement | null>;
  estimateItemHeight?: number;
  overscan?: number;
  threshold?: number;
};

export function useVirtualMessageWindow<T>({
  items,
  containerRef,
  estimateItemHeight = 92,
  overscan = 12,
  threshold = 180,
}: UseVirtualMessageWindowOptions<T>) {
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });
  const isVirtualized = items.length > threshold;

  const syncViewport = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport({
      scrollTop: el.scrollTop,
      height: el.clientHeight,
    });
  }, [containerRef]);

  useLayoutEffect(() => {
    syncViewport();
  }, [items.length, syncViewport]);

  const windowState = useMemo(() => {
    if (!isVirtualized) {
      return {
        visibleItems: items.map((item, index) => ({ item, index })),
        topPadding: 0,
        bottomPadding: 0,
        isVirtualized,
      };
    }

    const startIndex = Math.max(0, Math.floor(viewport.scrollTop / estimateItemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((viewport.scrollTop + viewport.height) / estimateItemHeight) + overscan
    );

    return {
      visibleItems: items.slice(startIndex, endIndex).map((item, offset) => ({
        item,
        index: startIndex + offset,
      })),
      topPadding: startIndex * estimateItemHeight,
      bottomPadding: Math.max(0, (items.length - endIndex) * estimateItemHeight),
      isVirtualized,
    };
  }, [estimateItemHeight, isVirtualized, items, overscan, viewport.height, viewport.scrollTop]);

  return {
    ...windowState,
    syncViewport,
  };
}
