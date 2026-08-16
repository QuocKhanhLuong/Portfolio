'use client';

import { useEffect, useRef } from 'react';
import type { Act, Locale } from '@/content/types';
import { smootherstep } from '@/lib/narrative/interpolate';
import { SCROLL_UNIT_VH } from '@/lib/narrative/timeline';
import { subscribeFrame } from '@/lib/narrative/ticker';
import { ActHeadline } from './ActHeadline';
import styles from './overlay.module.css';

const ALIGN = {
  center: styles.alignCenter,
  left: styles.alignLeft,
  right: styles.alignRight,
} as const;

/**
 * One act. Its height is its timeline weight, and its copy is stuck to the
 * viewport for the duration, so the scene moves through a state while the
 * sentence holds. Copy fades in on entry and out on exit — no observers, no
 * per-frame React state, just the shared frame written to a ref.
 */
export function ActSection({ act, index, locale }: { act: Act; index: number; locale: Locale }) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    return subscribeFrame((frame) => {
      const distance = frame.actIndex - index;
      let opacity: number;
      let shift: number;

      if (distance === 0) {
        // Inside the act: rise in, hold, settle out.
        const inFade = smootherstep(0.0, 0.16, frame.actProgress);
        const outFade = 1 - smootherstep(0.82, 1.0, frame.actProgress);
        opacity = inFade * outFade;
        shift = (1 - inFade) * 18 - (1 - outFade) * 10;
      } else if (Math.abs(distance) === 1) {
        // Neighbouring acts stay mounted but silent, so the sticky box never
        // pops when the boundary is crossed.
        opacity = 0;
        shift = distance > 0 ? 18 : -10;
      } else {
        opacity = 0;
        shift = 0;
      }

      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
      el.style.visibility = opacity < 0.004 ? 'hidden' : 'visible';
    });
  }, [index]);

  const height = `${Math.round(act.weight * SCROLL_UNIT_VH)}svh`;

  return (
    <section
      className={`${styles.act} ${ALIGN[act.align]}`}
      style={{ height }}
      aria-label={`${act.index} ${act.label}`}
    >
      <div className={styles.sticky}>
        <div className={styles.inner} ref={innerRef}>
          <span className={`kicker ${styles.kickerRow}`}>
            {act.index} <em>{act.label}</em>
          </span>
          <ActHeadline
            actIndex={index}
            text={act.headline[locale]}
            variant={index === 0 ? 'display' : 'headline'}
          />
          {act.lead && <p className={`lead ${styles.lead}`}>{act.lead[locale]}</p>}
          {act.body && (
            <div className={`body-copy ${styles.bodyCopy}`}>
              {act.body[locale].map((line) => (
                <p key={line.slice(0, 24)}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
