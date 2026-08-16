'use client';

import { useEffect, useRef } from 'react';
import { ACTS } from '@/content/acts';
import { useNarrative } from '@/lib/narrative/store';
import { subscribeFrame } from '@/lib/narrative/ticker';
import styles from './overlay.module.css';

/** Identity line. Deliberately the only fixed statement of who this is. */
export function Identity({ subtitle }: { subtitle: string }) {
  return (
    <div className={`${styles.hud} ${styles.hudLeft}`}>
      <b>ALVIN</b> · {subtitle}
    </div>
  );
}

export function LanguageToggle() {
  const locale = useNarrative((s) => s.locale);
  const setLocale = useNarrative((s) => s.setLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className={`${styles.hud} ${styles.hudRight}`}>
      <button
        type="button"
        className={styles.langButton}
        onClick={() => setLocale(locale === 'en' ? 'vi' : 'en')}
        aria-label={locale === 'en' ? 'Chuyển sang tiếng Việt' : 'Switch to English'}
      >
        [ <i>{locale.toUpperCase()}</i> / {locale === 'en' ? 'VI' : 'EN'} ]
      </button>
    </div>
  );
}

/**
 * The act rail. Labels are the acts themselves, not invented waypoints — the
 * structure it exposes is the structure the visitor is actually moving through.
 */
export function Rail() {
  const ref = useRef<HTMLElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let lastActive = -1;
    let shown = false;

    return subscribeFrame((frame) => {
      if (frame.progress > 0.015 !== shown) {
        shown = frame.progress > 0.015;
        root.classList.toggle(styles.railOn, shown);
      }
      if (frame.actIndex === lastActive) return;
      lastActive = frame.actIndex;
      items.current.forEach((el, i) => {
        if (!el) return;
        el.className = `${styles.railItem} ${
          i === lastActive ? styles.railActive : i < lastActive ? styles.railPast : ''
        }`;
      });
    });
  }, []);

  return (
    <nav className={styles.rail} ref={ref} aria-hidden="true">
      {ACTS.map((act, i) => (
        <div
          key={act.id}
          className={styles.railItem}
          ref={(el) => {
            items.current[i] = el;
          }}
        >
          {act.label}
        </div>
      ))}
    </nav>
  );
}

export function Spine() {
  const fill = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    return subscribeFrame((frame) => {
      el.style.height = `${(frame.progress * 100).toFixed(2)}%`;
    });
  }, []);

  return (
    <div className={styles.spine} aria-hidden="true">
      <i className={styles.spineFill} ref={fill} />
    </div>
  );
}

export function ScrollCue({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return subscribeFrame((frame) => {
      el.style.opacity = frame.progress > 0.02 ? '0' : '1';
    });
  }, []);

  return (
    <div className={styles.cue} ref={ref} aria-hidden="true">
      {label}
    </div>
  );
}
