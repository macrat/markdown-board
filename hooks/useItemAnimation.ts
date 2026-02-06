import { useState, useCallback, useRef, useEffect } from 'react';
import { ANIMATION_DURATION_MS } from '@/lib/constants';

interface AnimatingItem {
  id: string;
  type: 'fadeOut' | 'fadeIn';
}

export function useItemAnimation() {
  const [animatingItems, setAnimatingItems] = useState<AnimatingItem[]>([]);
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const startFadeOut = useCallback((id: string) => {
    setAnimatingItems((prev) => [...prev, { id, type: 'fadeOut' }]);
  }, []);

  const startFadeIn = useCallback((id: string) => {
    setAnimatingItems((prev) => [
      ...prev.filter((item) => item.id !== id),
      { id, type: 'fadeIn' },
    ]);
  }, []);

  const clearAnimation = useCallback((id: string) => {
    setAnimatingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItemOpacity = useCallback(
    (id: string) => {
      const animating = animatingItems.find((item) => item.id === id);
      if (!animating) return 1;
      return animating.type === 'fadeOut' ? 0 : 1;
    },
    [animatingItems],
  );

  const scheduleAfterAnimation = useCallback(
    (callback: () => void): NodeJS.Timeout => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        callback();
      }, ANIMATION_DURATION_MS);
      timersRef.current.add(timer);
      return timer;
    },
    [],
  );

  return {
    getItemOpacity,
    startFadeOut,
    startFadeIn,
    clearAnimation,
    scheduleAfterAnimation,
  };
}
