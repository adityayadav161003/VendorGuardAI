import React, { useEffect, useRef, useState } from 'react';

/** Smooth count-up number for KPI cards (respects reduced motion). */
export const CountUp: React.FC<{
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}> = ({ value, duration = 1100, decimals = 0, suffix = '', className = '' }) => {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (startedRef.current && display === value) return;
    startedRef.current = true;
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}{suffix}
    </span>
  );
};
