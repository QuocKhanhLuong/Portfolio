'use client';

import { useEffect, useRef } from 'react';
import { subscribeFrame } from '@/lib/narrative/ticker';
import styles from './overlay.module.css';

/**
 * A headline that can be unresolved.
 *
 * Two layers occupy the same box: the clean serif, and a degraded copy of the
 * same words. The act's `redaction` value cross-fades between them, so type
 * resolves — or comes apart — on exactly the scroll that resolves the field
 * behind it.
 *
 * The degraded layer is currently blur plus horizontal smear. When the
 * Redaction face is installed it swaps in here and nothing else changes.
 */
export function ActHeadline({
  actIndex,
  text,
  variant = 'headline',
}: {
  actIndex: number;
  text: string;
  variant?: 'display' | 'headline';
}) {
  const cleanRef = useRef<HTMLSpanElement>(null);
  const degradedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const clean = cleanRef.current;
    const degraded = degradedRef.current;
    if (!clean || !degraded) return;

    return subscribeFrame((frame) => {
      const r = frame.actIndex === actIndex ? frame.redaction : 0;
      clean.style.opacity = String(1 - r * 0.92);
      degraded.style.opacity = String(r);
      if (r > 0.002) {
        degraded.style.filter = `blur(${(r * 7).toFixed(2)}px)`;
        degraded.style.transform = `scaleX(${(1 + r * 0.012).toFixed(4)})`;
        degraded.style.visibility = 'visible';
      } else {
        degraded.style.visibility = 'hidden';
      }
    });
  }, [actIndex]);

  return (
    <h2 className={`${variant === 'display' ? 'display' : 'headline'} ${styles.headlineStack}`}>
      <span ref={cleanRef} className={styles.headlineClean}>
        {text}
      </span>
      <span ref={degradedRef} className={styles.headlineDegraded} aria-hidden="true">
        {text}
      </span>
    </h2>
  );
}
