'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ABOUT, CONTACT, INTRO } from '@/content/portfolio';
import { CAPABILITIES } from '@/content/capabilities';
import { PROJECTS } from '@/content/projects';
import { RESEARCH_NODES } from '@/content/research';
import { setScopeState, type ScopeShape } from '@/scene/SpecimenScope';
import { splitLines, type SplitLines } from './lines';
import styles from './overlay.module.css';

const MOTION_DURATIONS = {
  micro: 0.16,
  reveal: 0.52,
  scene: 0.8,
} as const;

const MOTION_EASES = {
  standard: 'power2.out',
  emphasized: 'power4.out',
} as const;

function externalProps(href: string) {
  return href.startsWith('http') ? { target: '_blank' as const, rel: 'noreferrer' } : {};
}

export function Portfolio() {
  const rootRef = useRef<HTMLElement>(null);
  const papers = RESEARCH_NODES.filter((node) => node.kind === 'paper' || node.kind === 'open');

  // Set up intersection observer for specimen state morphing & HUD updates
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = root.querySelectorAll<HTMLElement>('section[data-state]');
    const hudState = document.getElementById('hud-state');
    const hudIdx = document.getElementById('hud-idx');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const state = el.dataset.state as ScopeShape;
            const idx = el.dataset.idx;

            if (state) {
              setScopeState(state);
              if (hudState) {
                hudState.textContent = state.charAt(0).toUpperCase() + state.slice(1);
              }
            }
            if (idx && hudIdx) {
              hudIdx.textContent = `${idx} / 05`;
            }
          }
        });
      },
      { threshold: 0.45 },
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  // GSAP Entrance reveals
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const splits: SplitLines[] = [];
    let cancelled = false;

    const context = gsap.context(() => {
      // Line-masked reveals for headings
      const buildMaskedHeadings = () => {
        root.querySelectorAll<HTMLElement>('[data-motion="mask"]').forEach((heading) => {
          if (heading.closest('[data-hero]')) return;
          const split = splitLines(heading, styles.lineMask, styles.lineInner);
          if (!split) return;
          splits.push(split);

          gsap.fromTo(
            split.lines,
            { yPercent: 108 },
            {
              yPercent: 0,
              duration: MOTION_DURATIONS.reveal,
              ease: MOTION_EASES.emphasized,
              stagger: 0.08,
              scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
            },
          );
        });
      };

      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.ready.then(() => {
          if (cancelled) return;
          context.add(buildMaskedHeadings);
          ScrollTrigger.refresh();
        });
      } else {
        buildMaskedHeadings();
      }

      // Hero entrance
      const heroItems = root.querySelectorAll<HTMLElement>('[data-motion="hero"]');
      gsap.fromTo(
        heroItems,
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          duration: MOTION_DURATIONS.reveal,
          ease: MOTION_EASES.emphasized,
          stagger: 0.08,
          delay: 0.15,
          clearProps: 'transform',
        },
      );

      const heroTitle = root.querySelector<HTMLElement>('[data-motion="hero-title"]');
      if (heroTitle) {
        gsap.fromTo(
          heroTitle,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: MOTION_DURATIONS.scene,
            ease: MOTION_EASES.emphasized,
            delay: 0.1,
            clearProps: 'transform',
          },
        );
      }

      // Fade elements
      root.querySelectorAll<HTMLElement>('[data-motion="fade"]').forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: MOTION_DURATIONS.reveal,
            ease: MOTION_EASES.emphasized,
            clearProps: 'transform',
            scrollTrigger: { trigger: element, start: 'top 90%', once: true },
          },
        );
      });

      // Row reveals
      root.querySelectorAll<HTMLElement>('[data-motion="row"]').forEach((row) => {
        gsap.fromTo(
          row,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: MOTION_DURATIONS.reveal,
            ease: MOTION_EASES.emphasized,
            clearProps: 'transform',
            scrollTrigger: { trigger: row, start: 'top 88%', once: true },
          },
        );
      });
    }, root);

    return () => {
      cancelled = true;
      context.revert();
      splits.forEach((split) => split.revert());
    };
  }, []);

  return (
    <main className={styles.portfolio} id="top" ref={rootRef}>
      <a className={styles.skipLink} href="#about">
        Skip to portfolio content
      </a>

      {/* ── HERO — Specimen: Signal ── */}
      <section
        className={`${styles.sec} ${styles.hero}`}
        id="hero"
        data-state="signal"
        data-idx="00"
        aria-labelledby="hero-title"
        data-hero
      >
        <span className={styles.kicker} data-motion="hero">
          {INTRO.eyebrow}
        </span>

        <h1 className={styles.heroDisplay} id="hero-title" data-motion="hero-title">
          Lương&nbsp;Quốc
          <br />
          Khánh
        </h1>

        <p className={styles.heroLead} data-motion="hero">
          I read <em>visual structure</em> out of signal — 3D vision, medical imaging, representation learning.
        </p>

        <div className={styles.cta} data-motion="hero">
          <a
            className={styles.btn}
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Begin reading ↓
          </a>
          <a className={styles.link} href="#contact">
            Get in touch ↗
          </a>
        </div>
      </section>

      {/* ── 01 ABOUT — Specimen: Pixel (Scan matrix) ── */}
      <section
        className={styles.sec}
        id="about"
        data-state="pixel"
        data-idx="01"
        aria-labelledby="about-title"
      >
        <span className={styles.kicker} data-motion="fade">
          01 · About
        </span>

        <h2 className={styles.stitle} id="about-title" data-motion="mask">
          What a model keeps, and what it throws away.
        </h2>

        <p className={styles.stext} data-motion="fade">
          I work between visual understanding and the tools that make it possible to study — interested in what a
          representation preserves, what it discards, and how those choices reach the people who use its output.
        </p>
      </section>

      {/* ── 02 WORK — Specimen: Features (Detection Log) ── */}
      <section
        className={styles.sec}
        id="work"
        data-state="features"
        data-idx="02"
        aria-labelledby="work-title"
      >
        <span className={styles.kicker} data-motion="fade">
          02 · Selected work
        </span>

        <h2 className={styles.stitle} id="work-title" data-motion="mask">
          Readings taken from the field.
        </h2>

        <div className={styles.log}>
          {PROJECTS.map((project, index) => (
            <article
              key={project.id}
              className={styles.row}
              tabIndex={0}
              data-motion="row"
              aria-label={project.title}
            >
              <span className={styles.ix}>{String(index + 1).padStart(2, '0')}</span>

              <div>
                <h3 className={styles.rowTitle}>{project.title}</h3>
                <p className={styles.rowDesc}>{project.summary}</p>
                <div className={styles.rowTags}>
                  {project.stack.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <span className={styles.rowMeta}>
                Field / <b>{project.scene}</b>
                <br />
                2025
              </span>
            </article>
          ))}

          <article className={styles.row} tabIndex={0} data-motion="row">
            <span className={styles.ix}>04</span>
            <div>
              <h3 className={styles.rowTitle}>Calibration under distribution shift</h3>
              <p className={styles.rowDesc}>When should a model decline to answer? Evaluating uncertainty under domain shift.</p>
              <div className={styles.rowTags}>
                <span className={styles.tag}>Uncertainty</span>
                <span className={styles.tag}>Calibration</span>
                <span className={styles.tag}>OOD</span>
              </div>
            </div>
            <span className={styles.rowMeta}>
              Field / <b>Uncertainty</b>
              <br />
              Open
            </span>
          </article>
        </div>
      </section>

      {/* ── 03 RESEARCH — Specimen: Graph (Radial index) ── */}
      <section
        className={styles.sec}
        id="research"
        data-state="graph"
        data-idx="03"
        aria-labelledby="research-title"
      >
        <span className={styles.kicker} data-motion="fade">
          03 · Research
        </span>

        <h2 className={styles.stitle} id="research-title" data-motion="mask">
          Questions, papers, and the links between them.
        </h2>

        <p className={styles.stext} data-motion="fade">
          The field behind this section is a visual index — publications as nodes, relationships as edges. The
          readable record stays centred here.
        </p>

        <div className={styles.log} style={{ marginTop: '2rem' }}>
          {papers.map((node, index) => (
            <article
              key={node.id}
              className={styles.row}
              tabIndex={0}
              data-motion="row"
              aria-label={node.title ?? node.label}
            >
              <span className={styles.ix}>{String(index + 1).padStart(2, '0')}</span>

              <div>
                <h3 className={styles.rowTitle}>{node.title ?? node.label}</h3>
                <p className={styles.rowDesc}>{node.summary}</p>
                {node.links && node.links.length > 0 && (
                  <div style={{ marginTop: '0.4rem' }}>
                    {node.links.map((link) => (
                      <a
                        key={link.href}
                        className={styles.link}
                        href={link.href}
                        {...externalProps(link.href)}
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <span className={styles.rowMeta}>
                {node.meta.includes('2026') ? '2026' : node.meta.includes('2025') ? '2025' : 'Workshop'}
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* ── 04 EXPERIENCE — Specimen: Volume (Voxel shells / slice stack) ── */}
      <section
        className={styles.sec}
        id="experience"
        data-state="volume"
        data-idx="04"
        aria-labelledby="experience-title"
      >
        <span className={styles.kicker} data-motion="fade">
          04 · Experience
        </span>

        <h2 className={styles.stitle} id="experience-title" data-motion="mask">
          Research and engineering, kept close to the evidence.
        </h2>

        <div className={styles.clusters} data-motion="row">
          {CAPABILITIES.map((group) => (
            <div key={group.title} className={styles.cluster}>
              <h3 className={styles.clusterTitle}>{group.title}</h3>
              <ul className={styles.clusterList}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 CONTACT — Specimen: Constellation (Calm ending) ── */}
      <section
        className={styles.sec}
        id="contact"
        data-state="constellation"
        data-idx="05"
        aria-labelledby="contact-title"
      >
        <span className={styles.kicker} data-motion="fade">
          05 · Contact
        </span>

        <h2 className={styles.stitle} id="contact-title" data-motion="mask">
          Open to careful questions and difficult visual problems.
        </h2>

        <div className={styles.chan} data-motion="fade">
          {CONTACT.links.map((link) =>
            link.href ? (
              <a key={link.label} href={link.href} {...externalProps(link.href)}>
                {link.label} ↗
              </a>
            ) : (
              <a key={link.label} href="#contact">
                {link.label}
              </a>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
