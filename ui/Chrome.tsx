'use client';

import { useEffect, useRef, useState } from 'react';
import { NAV_ITEMS } from '@/content/portfolio';
import { subscribeFrame } from '@/lib/narrative/ticker';
import styles from './overlay.module.css';

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header
      className={`${styles.siteHeader} ${isScrolled ? styles.siteHeaderScrolled : ''} ${
        isMobileMenuOpen ? styles.siteHeaderMenuOpen : ''
      }`}
    >
      <a className={styles.brand} href="#top" aria-label="Luong Quoc Khanh, back to top" onClick={closeMenu}>
        <span className={styles.brandName}>Luong Quoc Khanh</span>
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

      <button
        ref={menuButtonRef}
        className={styles.menuToggle}
        type="button"
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-navigation"
        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        <span className={styles.menuToggleLabel}>{isMobileMenuOpen ? 'Close' : 'Menu'}</span>
        <span className={`${styles.menuGlyph} ${isMobileMenuOpen ? styles.menuGlyphOpen : ''}`} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      <div
        className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ''}`}
        id="mobile-navigation"
        aria-label="Mobile navigation"
      >
        <div className={styles.mobileMenuInner}>
          <nav className={styles.mobileMenuNav}>
            {NAV_ITEMS.map((item, index) => (
              <a
                key={item.href}
                className={styles.mobileMenuLink}
                href={item.href}
                tabIndex={isMobileMenuOpen ? 0 : -1}
                onClick={closeMenu}
                style={{ transitionDelay: isMobileMenuOpen ? `${index * 75}ms` : '0ms' }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.mobileMenuActions}>
            <a
              className={styles.mobileMenuQuietAction}
              href="#work"
              tabIndex={isMobileMenuOpen ? 0 : -1}
              onClick={closeMenu}
            >
              View selected work <span aria-hidden="true">↘</span>
            </a>
            <a
              className={styles.mobileMenuPrimaryAction}
              href="#contact"
              tabIndex={isMobileMenuOpen ? 0 : -1}
              onClick={closeMenu}
            >
              Get in touch <span aria-hidden="true">↘</span>
            </a>
          </div>
        </div>
      </div>
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
