import React, { useEffect, useRef, useState } from 'react';

/**
 * Fades and lifts its children the first time they scroll into view.
 *
 * IntersectionObserver rather than a scroll listener: no work happens on frames where nothing
 * crosses the threshold, and it disconnects once revealed. A visitor who asked for reduced
 * motion starts revealed, so nothing ever animates for them.
 */
const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Props = {
  children: React.ReactNode;
  /** Milliseconds to hold back, for staggering siblings. */
  delay?: number;
  className?: string;
};

const Reveal: React.FC<Props> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    if (shown || !ref.current) return;
    const el = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // Trigger a little before it reaches the fold, so it has finished by the time it's read.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(18px)',
        transition: prefersReducedMotion()
          ? undefined
          : `opacity 600ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 600ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

export default Reveal;
