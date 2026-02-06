import { useState, useCallback, useRef, useEffect } from 'react';
import { ANIMATION_DURATION_MS } from '@/lib/constants';

interface AnimatingItem {
  id: string;
  type: 'fadeOut' | 'fadeIn';
}

export function useAnimatingItems() {
  const [animatingItems, setAnimatingItems] = useState<AnimatingItem[]>([]);
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const scheduleTimer = useCallback((callback: () => void): void => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, ANIMATION_DURATION_MS);
    timersRef.current.add(timer);
  }, []);

  const startFadeOut = useCallback(
    (id: string, onComplete: () => void) => {
      setAnimatingItems((prev) => [...prev, { id, type: 'fadeOut' }]);
      scheduleTimer(onComplete);
    },
    [scheduleTimer],
  );

  const startFadeIn = useCallback(
    (id: string) => {
      setAnimatingItems((prev) => [
        ...prev.filter((item) => item.id !== id),
        { id, type: 'fadeIn' },
      ]);
      scheduleTimer(() => {
        setAnimatingItems((prev) => prev.filter((item) => item.id !== id));
      });
    },
    [scheduleTimer],
  );

  const clearAnimation = useCallback((id: string) => {
    setAnimatingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItemOpacity = useCallback(
    (id: string): number => {
      const animating = animatingItems.find((item) => item.id === id);
      if (!animating) return 1;
      return animating.type === 'fadeOut' ? 0 : 1;
    },
    [animatingItems],
  );

  return { startFadeOut, startFadeIn, clearAnimation, getItemOpacity };
}
