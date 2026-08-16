'use client';

import { useEffect, useRef } from 'react';
import { NAV_ITEMS } from '@/content/portfolio';
import { subscribeFrame } from '@/lib/narrative/ticker';
import styles from './overlay.module.css';

export function SiteHeader() {
  return (
    <header className={styles.siteHeader}>
      <a className={styles.brand} href="#top" aria-label="Alvin Luong, back to top">
        <span className={styles.brandName}>Alvin Luong</span>
        <span className={styles.brandRole}>Computer vision research / engineering</span>
      </a>

      <nav className={styles.primaryNav} aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <a className={styles.headerContact} href="#contact">
        Contact <span aria-hidden="true">↘</span>
      </a>
    </header>
  );
}

export function ProgressLine() {
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = fill.current;
    if (!element) return;

    return subscribeFrame((frame) => {
      element.style.height = `${(frame.progress * 100).toFixed(2)}%`;
    });
  }, []);

  return (
    <div className={styles.progressLine} aria-hidden="true">
      <span ref={fill} />
    </div>
  );
}

export function ScrollCue() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return subscribeFrame((frame) => {
      element.style.opacity = frame.progress > 0.02 ? '0' : '1';
    });
  }, []);

  return (
    <div className={styles.scrollCue} ref={ref} aria-hidden="true">
      Scroll to explore <span>↓</span>
    </div>
  );
}
