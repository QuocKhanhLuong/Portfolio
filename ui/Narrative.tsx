'use client';

import { useEffect } from 'react';
import { ACTS, CONTACT } from '@/content/acts';
import { startNarrativeDriver } from '@/lib/narrative/driver';
import { useNarrative } from '@/lib/narrative/store';
import { ActSection } from './ActSection';
import { Identity, LanguageToggle, Rail, ScrollCue, Spine } from './Chrome';
import styles from './overlay.module.css';

const SUBTITLE = {
  en: 'computer vision research',
  vi: 'nghiên cứu thị giác máy tính',
};

const CUE = { en: 'scroll', vi: 'cuộn' };

/**
 * The DOM half of the experience. Mounts the one scroll driver, then renders
 * the acts in order. Everything animated below this point reads the shared
 * narrative frame; nothing subscribes to scroll on its own.
 */
export function Narrative() {
  const locale = useNarrative((s) => s.locale);
  const setReducedMotion = useNarrative((s) => s.setReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);

    const stop = startNarrativeDriver({ reducedMotion: query.matches });
    return () => {
      query.removeEventListener('change', apply);
      stop();
    };
  }, [setReducedMotion]);

  return (
    <>
      <Identity subtitle={SUBTITLE[locale]} />
      <LanguageToggle />
      <Rail />
      <Spine />
      <ScrollCue label={CUE[locale]} />

      <main className={styles.root}>
        {ACTS.map((act, i) => (
          <ActSection key={act.id} act={act} index={i} locale={locale} />
        ))}

        <section className={`${styles.act} ${styles.alignCenter}`} style={{ height: '100svh' }}>
          <div className={styles.sticky}>
            <div className={styles.inner}>
              <p className={`lead ${styles.lead}`}>{CONTACT.invitation[locale]}</p>
              <div className={styles.links}>
                {CONTACT.links.map((link) => (
                  <a key={link.label} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
