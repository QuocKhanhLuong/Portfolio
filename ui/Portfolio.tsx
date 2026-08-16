'use client';

import { useLayoutEffect, useRef } from 'react';
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
import styles from './overlay.module.css';

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
  const activate = () => setSceneFocus(state);
  const clear = () => setSceneFocus(null);
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

  return article ? <article {...shared}>{children}</article> : <div {...shared}>{children}</div>;
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
    <header className={styles.sectionHeader} data-motion="section">
      <p className={styles.sectionMarker} data-motion="line">
        <span>{number}</span> / {label}
      </p>
      <div>
        <h2 className={styles.sectionTitle} id={id}>
          {title}
        </h2>
        {description && <p className={styles.sectionDescription}>{description}</p>}
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

    const context = gsap.context(() => {
      const heroItems = root.querySelectorAll<HTMLElement>('[data-motion="hero"]');
      gsap.fromTo(
        heroItems,
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'all' },
      );

      root.querySelectorAll<HTMLElement>('[data-motion="section"]').forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: element, start: 'top 84%', once: true },
          },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-motion="row"]').forEach((row) => {
        const items = row.querySelectorAll<HTMLElement>('[data-motion="row-item"]');
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.62,
            ease: 'power2.out',
            stagger: 0.045,
            scrollTrigger: { trigger: row, start: 'top 88%', once: true },
          },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-motion="metadata"]').forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, x: -8 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: { trigger: element.closest('[data-motion="row"]') ?? element, start: 'top 88%', once: true },
          },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-motion="line"]').forEach((element) => {
        gsap.fromTo(
          element,
          { scaleX: 0, transformOrigin: 'left center' },
          {
            scaleX: 1,
            duration: 0.75,
            ease: 'power2.out',
            scrollTrigger: { trigger: element, start: 'top 86%', once: true },
          },
        );
      });

      root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((element) => {
        gsap.to(element, {
          yPercent: -7,
          ease: 'none',
          scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
        });
      });
    }, root);

    return () => context.revert();
  }, []);

  return (
    <main className={styles.portfolio} id="top" ref={rootRef}>
      <a className={styles.skipLink} href="#about">
        Skip to portfolio content
      </a>

      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="intro-title">
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow} data-motion="hero">
              {INTRO.eyebrow}
            </p>
            <h1 className="display" id="intro-title" data-motion="hero">
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
          </div>
          <aside className={styles.heroAside} aria-label="Current focus" data-motion="hero" data-parallax="light">
            <span className={styles.heroAsideRule} />
            <p className="mono">{INTRO.note}</p>
            <p>
              A portfolio of visual systems, research questions, and the tools that help make their structure
              visible.
            </p>
          </aside>
        </div>
      </section>

      <section className={styles.section} id="about" aria-labelledby="about-title">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="01"
            label="About"
            title="Working between visual evidence and understanding."
            description="A short account of the questions that connect the work."
            id="about-title"
          />
          <div className={styles.aboutGrid} data-parallax="light">
            <div className="body-copy">
              {ABOUT.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className={styles.domainList} aria-label="Research domains">
              {ABOUT.domains.map((domain) => (
                <SceneFocus key={domain.label} state={domain.scene} className={styles.domainItem} label={domain.label}>
                  <span className={styles.domainName}>{domain.label}</span>
                  <span className={styles.domainDetail}>{domain.detail}</span>
                </SceneFocus>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="work" aria-labelledby="work-title">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="02"
            label="Selected work"
            title="Projects that make visual structure useful."
            description="Hover or focus an entry to inspect the related field state."
            id="work-title"
          />
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
                <span className={styles.rowIndex} data-motion="row-item">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className={styles.rowMain} data-motion="row-item">
                  <p className={styles.rowMeta} data-motion="metadata">
                    {project.meta}
                  </p>
                  <h3 className={styles.rowTitle}>{project.title}</h3>
                  <p className={styles.rowSummary}>{project.summary}</p>
                  <div className={styles.tagList} aria-label="Technology stack" data-motion="row-item">
                    {project.stack.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.rowAside} data-motion="row-item">
                  <span className={styles.sceneLabel}>Field / {project.scene}</span>
                  {project.href ? (
                    <a className={styles.rowLink} href={project.href} {...externalProps(project.href)}>
                      Case study <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span className={styles.unavailable}>Case study pending</span>
                  )}
                </div>
              </SceneFocus>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="research" aria-labelledby="research-title">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="03"
            label="Research / publications"
            title="Questions, papers, and the relationships between them."
            description="The background graph is a visual index. The readable record stays here."
            id="research-title"
          />
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
                  <span className={styles.rowIndex} data-motion="row-item">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.rowMain} data-motion="row-item">
                    <p className={styles.rowMeta} data-motion="metadata">
                      {node.meta}
                    </p>
                    <h3 className={styles.rowTitle}>{node.title ?? node.label}</h3>
                    <p className={styles.rowSummary}>{node.summary}</p>
                  </div>
                  <div className={styles.rowAside} data-motion="row-item">
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
                </SceneFocus>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} id="experience" aria-labelledby="experience-title">
        <div className={styles.sectionInner}>
          <SectionHeading
            number="04"
            label="Experience"
            title="Research and engineering, kept close to the evidence."
            id="experience-title"
          />
          <div className={styles.experienceList}>
            {EXPERIENCE.map((item) => (
              <article key={item.id} className={styles.experienceRow} data-motion="row">
                <p className={styles.rowMeta} data-motion="metadata">
                  {item.period}
                </p>
                <div data-motion="row-item">
                  <h3 className={styles.rowTitle}>{item.role}</h3>
                  <p className={styles.experienceOrganization}>{item.organization}</p>
                  <p className={styles.rowSummary}>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.capabilityBlock}>
            <p className={styles.subsectionMarker}>Technical capabilities</p>
            <div className={styles.capabilityGrid}>
              {CAPABILITIES.map((group) => (
                <SceneFocus
                  key={group.title}
                  state={group.scene}
                  className={styles.capabilityGroup}
                  label={group.title}
                  motion="row"
                >
                  <h3 data-motion="row-item">{group.title}</h3>
                  <ul data-motion="row-item">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </SceneFocus>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.contactSection}`} id="contact" aria-labelledby="contact-title">
        <div className={styles.contactInner}>
          <p className={styles.eyebrow} data-motion="section">
            05 / Contact
          </p>
          <h2 className="headline" id="contact-title" data-motion="section">
            Open to careful questions and difficult visual problems.
          </h2>
          <p className={styles.contactLead} data-motion="section">
            {CONTACT.invitation}
          </p>
          <div className={styles.contactLinks} data-motion="row">
            {CONTACT.links.map((link) =>
              link.href ? (
                <a key={link.label} href={link.href} data-motion="row-item" {...externalProps(link.href)}>
                  {link.label} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span key={link.label} className={styles.pendingLink} data-motion="row-item">
                  <span>{link.label}</span>
                  <small>{link.note}</small>
                </span>
              ),
            )}
          </div>
          <p className={styles.footerNote} data-parallax="light">
            Luong Quoc Khanh · Computer vision research / engineering
          </p>
        </div>
      </section>
    </main>
  );
}
