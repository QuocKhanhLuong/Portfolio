'use client';

import { useEffect, useState } from 'react';
import { SCOPE_PARTICLE_COUNT } from '@/scene/SpecimenScope';
import styles from './overlay.module.css';

export interface NavItem {
  href: string;
  label: string;
  id: string;
}

export const SPECIMEN_NAV_ITEMS: NavItem[] = [
  { href: '#hero', label: 'Index', id: 'hero' },
  { href: '#about', label: 'About', id: 'about' },
  { href: '#work', label: 'Work', id: 'work' },
  { href: '#research', label: 'Research', id: 'research' },
  { href: '#experience', label: 'Experience', id: 'experience' },
  { href: '#contact', label: 'Contact', id: 'contact' },
];

export function ViewfinderHUD() {
  return (
    <div className={styles.hud} aria-hidden="true">
      {/* 4 Corner brackets */}
      <span className={`${styles.cnr} ${styles.cnrTl}`} />
      <span className={`${styles.cnr} ${styles.cnrTr}`} />
      <span className={`${styles.cnr} ${styles.cnrBl}`} />
      <span className={`${styles.cnr} ${styles.cnrBr}`} />

      {/* Pulsing REC dot */}
      <span className={styles.rec} />

      {/* Top specimen state & particle count readout */}
      <div className={styles.hudTop}>
        <span>
          Specimen ▸ <b id="hud-state">Signal</b>
        </span>
        <span id="hud-idx">00 / 05</span>
        <span>N={SCOPE_PARTICLE_COUNT}</span>
      </div>

      {/* Edge labels */}
      <div className={styles.hudLft}>Reading station · v3</div>
      <div className={styles.hudRgt} id="hud-coord">
        X 0.00 · Y 0.00
      </div>

      {/* Exact centre reticle */}
      <span className={styles.reticle} />
    </div>
  );
}

export function SiteHeader() {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const sections = SPECIMEN_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
        Boolean,
      ) as HTMLElement[];
      const scrollPos = window.scrollY + window.innerHeight * 0.45;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPos) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={styles.nav} aria-label="Specimen Scope Navigation">
      {SPECIMEN_NAV_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <a
            key={item.href}
            href={item.href}
            className={isActive ? styles.navOn : ''}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(item.id);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export function BottomNote() {
  return (
    <div className={styles.bottomNote} aria-hidden="true">
      Scroll — the instrument refocuses on each specimen
    </div>
  );
}
