'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { FocusEvent, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ABOUT, CONTACT, INTRO } from '@/content/portfolio';
import { CAPABILITIES } from '@/content/capabilities';
import { EXPERIENCE } from '@/content/experience';
import { PROJECTS } from '@/content/projects';
import { RESEARCH_NODES } from '@/content/research';
import type { SceneState } from '@/content/types';
import { setSceneFocus } from '@/lib/narrative/store';
import { FieldPanel } from '@/scene/FieldPanel';
import { splitLines, type SplitLines } from './lines';
import styles from './overlay.module.css';

const MOTION_DURATIONS = {
  micro: 0.16,
  reveal: 0.5,
  scene: 0.8,
} as const;

const MOTION_EASES = {
  standard: 'power2.out',
  emphasized: 'power4.out',
} as const;

/**
 * A foreground item that can ask the field to inspect a related state.
 *
 * The DOM response and the scene response are driven from the same handler, so
 * a foreground item and its field state start on the same event. Layout stays
 * fixed; hover feedback is expressed by rules and colour rather than movement.
 */
function SceneFocus({
  state,
  children,
  className = '',
  article = false,
  label,
  motion,
}: {
  state: SceneState;
  children: ReactNode;
  className?: string;
  article?: boolean;
  label?: string;
  motion?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  const activate = useCallback(() => {
    setSceneFocus(state);
  }, [state]);

  const clear = useCallback(() => {
    setSceneFocus(null);
  }, []);

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) clear();
  };

  const shared = {
    className: `${styles.sceneFocus} ${className}`,
    tabIndex: 0,
    onPointerEnter: activate,
    onPointerLeave: clear,
    onFocus: activate,
    onBlur: handleBlur,
    'aria-label': label,
    'data-motion': motion,
  };

  return article ? (
    <article ref={ref as React.RefObject<HTMLElement>} {...shared}>
      {children}
    </article>
  ) : (
    <div ref={ref as React.RefObject<HTMLDivElement>} {...shared}>
      {children}
    </div>
  );
}

function SectionHeading({
  number,
  label,
  title,
  description,
  id,
}: {
  number: string;
  label: string;
  title: string;
  description?: string;
  id: string;
}) {
  return (
    <header className={styles.sectionHeader} data-motion="section-header">
      <div className={styles.sectionMarkerBlock}>
        <p className={styles.sectionMarker} data-motion="fade">
          <span>{number}</span> / {label}
        </p>
        {/* A rule is a rule. Scaling the marker text horizontally to fake one
            distorted the letterforms for the length of the tween. */}
        <span className={styles.sectionRule} data-motion="rule" aria-hidden="true" />
      </div>
      <div>
        <h2 className={styles.sectionTitle} id={id} data-motion="mask">
          {title}
        </h2>
        {description && (
          <p className={styles.sectionDescription} data-motion="fade">
            <span>{description}</span>
          </p>
        )}
      </div>
    </header>
  );
}

function externalProps(href: string) {
  return href.startsWith('http') ? { target: '_blank' as const, rel: 'noreferrer' } : {};
}

export function Portfolio() {
  const papers = RESEARCH_NODES.filter((node) => node.kind === 'paper' || node.kind === 'open');
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const splits: SplitLines[] = [];
    let cancelled = false;
    const handleSpotlightMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest('[data-spotlight]') as HTMLElement | null;
      if (!target || !root.contains(target)) return;

      const rect = target.getBoundingClientRect();
      target.style.setProperty('--spotlight-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
      target.style.setProperty('--spotlight-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
    };

    root.addEventListener('pointermove', handleSpotlightMove);

    const context = gsap.context(() => {
      // ── text ───────────────────────────────────────────────────────────────
      // Headings reveal by the line, from behind a mask. Body copy and metadata
      // arrive as a short stagger underneath them.
      const buildMaskedHeadings = () => {
        root.querySelectorAll<HTMLElement>('[data-motion="mask"]').forEach((heading) => {
          const split = splitLines(heading, styles.lineMask, styles.lineInner);
          if (!split) return;
          splits.push(split);

          const isHero = !!heading.closest('[data-hero]');
          gsap.fromTo(
            split.lines,
            { yPercent: 108 },
            {
              yPercent: 0,
              duration: isHero ? MOTION_DURATIONS.scene : MOTION_DURATIONS.reveal,
              ease: MOTION_EASES.emphasized,
              stagger: 0.075,
              delay: isHero ? 0.12 : 0,
              scrollTrigger: isHero
                ? undefined
                : { trigger: heading, start: 'top 88%', once: true },
            },
          );
        });
      };

      // Splitting depends on final metrics; web fonts change where lines break.
      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.ready.then(() => {
          if (cancelled) return;
          context.add(buildMaskedHeadings);
          ScrollTrigger.refresh();
        });
      } else {
        buildMaskedHeadings();
      }

      const heroItems = root.querySelectorAll<HTMLElement>('[data-motion="hero"]');
      gsap.fromTo(
        heroItems,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: MOTION_DURATIONS.reveal,
          ease: MOTION_EASES.emphasized,
          stagger: 0.075,
          delay: 0.18,
          clearProps: 'transform',
        },
      );

      root.querySelectorAll<HTMLElement>('[data-motion="fade"]').forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 12 },
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

      root.querySelectorAll<HTMLElement>('[data-motion="rule"]').forEach((element) => {
        gsap.fromTo(
          element,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: MOTION_DURATIONS.scene,
            ease: MOTION_EASES.standard,
            scrollTrigger: { trigger: element, start: 'top 92%', once: true },
          },
        );
      });

      // ── blocks ─────────────────────────────────────────────────────────────
      // One timeline per row, so an entry assembles in reading order: number,
      // metadata, title, summary, then supporting detail.
      root.querySelectorAll<HTMLElement>('[data-motion="row"]').forEach((row) => {
        const pick = (selector: string) => Array.from(row.querySelectorAll<HTMLElement>(selector));
        const index = pick('[data-motion="row-index"]');
        const meta = pick('[data-motion="metadata"]');
        const lead = pick('[data-motion="row-lead"]:not([data-editorial-focus])');
        const detail = pick('[data-motion="row-detail"]');

        const timeline = gsap.timeline({
          defaults: { ease: MOTION_EASES.emphasized, clearProps: 'transform' },
          scrollTrigger: { trigger: row, start: 'top 86%', once: true },
        });

        if (index.length) timeline.fromTo(index, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: MOTION_DURATIONS.reveal }, 0);
        if (meta.length) timeline.fromTo(meta, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: MOTION_DURATIONS.reveal }, 0.06);
        if (lead.length)
          timeline.fromTo(
            lead,
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: MOTION_DURATIONS.scene, stagger: 0.06 },
            0.1,
          );
        if (detail.length)
          timeline.fromTo(
            detail,
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: MOTION_DURATIONS.reveal, stagger: 0.05 },
            0.22,
          );
      });

      // Editorial focus owns the large text moments from entry through exit.
      // The section headings are ordinary flow content; this scrub supplies the
      // focus choreography that used to be implied by a sticky handoff.
      root
        .querySelectorAll<HTMLElement>('[data-motion="section-header"], [data-editorial-focus]')
        .forEach((element) => {
          const section = element.closest('section');
          const row = element.closest('[data-motion="row"]');
          const trigger = element.matches('[data-motion="section-header"]') ? section : row ?? element;
          if (!trigger) return;

          const focus = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { trigger, start: 'top 88%', end: 'bottom 18%', scrub: 0.7 },
          });

          focus
            .fromTo(
              element,
              { opacity: 0, y: 10 },
              { opacity: 1, y: 0, duration: MOTION_DURATIONS.micro },
            )
            .to(element, { opacity: 1, y: 0, duration: MOTION_DURATIONS.reveal })
            .to(element, { opacity: 0.25, y: -10, duration: MOTION_DURATIONS.micro });
        });

      // Parallax targets are always dedicated wrappers. An element that is both
      // entering and parallaxing has two owners for one transform, and the
      // scrubbed one wins at an arbitrary moment.
      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((element) => {
        gsap.fromTo(
          element,
          { yPercent: 4 },
          {
            yPercent: -4,
            ease: 'none',
            scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
          },
        );
      });
    }, root);

    return () => {
      cancelled = true;
      root.removeEventListener('pointermove', handleSpotlightMove);
      context.revert();
      splits.forEach((split) => split.revert());
    };
  }, []);

  return (
    <main className={styles.portfolio} id="top" ref={rootRef}>
      <a className={styles.skipLink} href="#about">
        Skip to portfolio content
      </a>

      <section
        className={`${styles.section} ${styles.hero}`}
        aria-labelledby="intro-title"
        data-scene="signal"
        data-hero=""
      >
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow} data-motion="hero">
              {INTRO.eyebrow}
            </p>
            <h1 className={`${styles.heroName} display`} id="intro-title" data-motion="mask">
              {INTRO.title}
            </h1>
            <p className={styles.positioning} data-motion="hero">
              {INTRO.positioning}
            </p>
            <div className={styles.actionRow} data-motion="hero">
              <a className={styles.primaryAction} href="#work">
                View selected work <span aria-hidden="true">↘</span>
              </a>
              <a className={styles.quietAction} href="#contact">
                Get in touch
              </a>
            </div>
            <div data-parallax="light" className={styles.heroAsideContent}>
              <span className={styles.heroAsideRule} />
              <p className="mono">{INTRO.note}</p>
              <p>
                A portfolio of visual systems, research questions, and the tools that help make their structure
                visible.
              </p>
            </div>
          </div>
          <FieldPanel state="signal" align="right" className={styles.heroField} />
        </div>
      </section>

      <section className={styles.section} id="about" aria-labelledby="about-title" data-scene="pixel">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="01"
            label="About"
            title="Working between visual evidence and understanding."
            description="A short account of the questions that connect the work."
            id="about-title"
          />
          <div className={`${styles.sectionLayout} ${styles.layoutLeft}`}>
            <FieldPanel state="pixel" align="left" className={styles.sectionField} />
            <div className={styles.sectionContent}>
              <div className={styles.aboutGrid} data-motion="row">
                <div className="body-copy" data-motion="row-lead">
                  {ABOUT.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <div className={styles.domainList} aria-label="Research domains">
                  {ABOUT.domains.map((domain) => (
                    <SceneFocus
                      key={domain.label}
                      state={domain.scene}
                      className={styles.domainItem}
                      label={domain.label}
                      motion="row-detail"
                    >
                      <span className={styles.domainName}>{domain.label}</span>
                      <span className={styles.domainDetail}>{domain.detail}</span>
                    </SceneFocus>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="work" aria-labelledby="work-title" data-scene="features">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="02"
            label="Selected work"
            title="Projects that make visual structure useful."
            description="Hover or focus an entry to inspect the related field state."
            id="work-title"
          />
          <div className={`${styles.sectionLayout} ${styles.layoutRight}`}>
            <div className={styles.sectionContent}>
          <div className={styles.projectList}>
            {PROJECTS.map((project, index) => (
              <SceneFocus
                key={project.id}
                state={project.scene}
                article
                className={styles.projectRow}
                label={project.title}
                motion="row"
              >
                <span className={styles.rowIndex} data-motion="row-index" data-scene={project.scene}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className={styles.rowMain}>
                  <p className={styles.rowMeta} data-motion="metadata">
                    {project.meta}
                  </p>
                  <h3 className={styles.rowTitle} data-motion="row-lead" data-editorial-focus="true">
                    {project.title}
                  </h3>
                  <p className={styles.rowSummary} data-motion="row-lead">
                    {project.summary}
                  </p>
                  <div className={styles.tagList} aria-label="Technology stack" data-motion="row-detail">
                    {project.stack.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className={styles.rowMetaFooter} data-motion="row-detail">
                    <span className={styles.sceneLabel}>Field / {project.scene}</span>
                    {project.href ? (
                      <a className={styles.rowLink} href={project.href} {...externalProps(project.href)}>
                        Case study <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span className={styles.unavailable}>Case study pending</span>
                    )}
                  </div>
                </div>
              </SceneFocus>
            ))}
          </div>
            </div>
            <FieldPanel state="features" align="right" className={styles.sectionField} />
          </div>
        </div>
      </section>

      <section className={styles.section} id="research" aria-labelledby="research-title" data-scene="uncertainty">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="03"
            label="Research / publications"
            title="Questions, papers, and the relationships between them."
            description="The background graph is a visual index. The readable record stays here."
            id="research-title"
          />
          <div className={`${styles.sectionLayout} ${styles.layoutLeft}`}>
            <FieldPanel state="uncertainty" align="left" className={styles.sectionField} />
            <div className={styles.sectionContent}>
          <div className={styles.researchList}>
            {papers.map((node, index) => {
              const scene: SceneState = node.kind === 'open' ? 'uncertainty' : 'graph';
              return (
                <SceneFocus
                  key={node.id}
                  state={scene}
                  article
                  className={styles.researchRow}
                  label={node.label}
                  motion="row"
                >
                  <span className={styles.rowIndex} data-motion="row-index" data-scene={scene}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.rowMain}>
                    <p className={styles.rowMeta} data-motion="metadata">
                      {node.meta}
                    </p>
                    <h3 className={styles.rowTitle} data-motion="row-lead" data-editorial-focus="true">
                      {node.title ?? node.label}
                    </h3>
                    <p className={styles.rowSummary} data-motion="row-lead">
                      {node.summary}
                    </p>
                    <div className={styles.rowMetaFooter} data-motion="row-detail">
                      <span className={styles.sceneLabel}>Field / {scene}</span>
                      {node.links?.length ? (
                        node.links.map((link) => (
                          <a key={link.href} className={styles.rowLink} href={link.href} {...externalProps(link.href)}>
                            {link.label} <span aria-hidden="true">↗</span>
                          </a>
                        ))
                      ) : (
                        <span className={styles.unavailable}>Publication link pending</span>
                      )}
                    </div>
                  </div>
                </SceneFocus>
              );
            })}
          </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="experience" aria-labelledby="experience-title" data-scene="graph">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="04"
            label="Experience"
            title="Research and engineering, kept close to the evidence."
            id="experience-title"
          />
          <div className={`${styles.sectionLayout} ${styles.layoutRight}`}>
            <div className={styles.sectionContent}>
          <div className={styles.experienceList}>
            {EXPERIENCE.map((item) => (
              <article key={item.id} className={styles.experienceRow} data-motion="row">
                <p className={styles.rowMeta} data-motion="metadata">
                  {item.period}
                </p>
                <div>
                  <h3 className={styles.rowTitle} data-motion="row-lead">
                    {item.role}
                  </h3>
                  <p className={styles.experienceOrganization} data-motion="row-detail">
                    {item.organization}
                  </p>
                  <p className={styles.rowSummary} data-motion="row-detail">
                    {item.summary}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.capabilityBlock}>
            <p className={styles.subsectionMarker} data-motion="fade">
              Technical capabilities
            </p>
            <div className={styles.capabilityGrid}>
              {CAPABILITIES.map((group, index) => (
                <SceneFocus
                  key={group.title}
                  state={group.scene}
                  className={styles.capabilityGroup}
                  label={group.title}
                  motion="row"
                >
                  <span className={styles.capabilityIndex} data-motion="row-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 data-motion="row-lead">{group.title}</h3>
                  <ul data-motion="row-detail">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </SceneFocus>
              ))}
            </div>
          </div>
            </div>
            <FieldPanel state="graph" align="right" className={styles.sectionField} />
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.contactSection}`}
        id="contact"
        aria-labelledby="contact-title"
        data-scene="constellation"
      >
        <div className={`${styles.contactInner} ${styles.spotlightPanel}`} data-motion="row" data-spotlight>
          <div className={styles.contactCopy}>
            <p className={styles.eyebrow} data-motion="metadata">
              05 / Contact
            </p>
            <h2 className="headline" id="contact-title" data-motion="mask" data-editorial-focus="true">
              Open to careful questions and difficult visual problems.
            </h2>
            <p className={styles.contactLead} data-motion="row-detail">
              {CONTACT.invitation}
            </p>
            <div className={styles.contactLinks}>
              {CONTACT.links.map((link) =>
                link.href ? (
                  <a key={link.label} href={link.href} data-motion="row-detail" {...externalProps(link.href)}>
                    {link.label} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span key={link.label} className={styles.pendingLink} data-motion="row-detail">
                    <span>{link.label}</span>
                    <small>{link.note}</small>
                  </span>
                ),
              )}
            </div>
            <p className={styles.footerNote}>Luong Quoc Khanh · Computer vision research / engineering</p>
          </div>
        </div>
      </section>
    </main>
  );
}
