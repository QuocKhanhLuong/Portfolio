'use client';

import type { FocusEvent, ReactNode } from 'react';
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
}: {
  state: SceneState;
  children: ReactNode;
  className?: string;
  article?: boolean;
  label?: string;
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
    <header className={styles.sectionHeader}>
      <p className={styles.sectionMarker}>
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

  return (
    <main className={styles.portfolio} id="top">
      <a className={styles.skipLink} href="#about">
        Skip to portfolio content
      </a>

      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="intro-title">
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>{INTRO.eyebrow}</p>
            <h1 className="display" id="intro-title">
              {INTRO.title}
            </h1>
            <p className={styles.positioning}>{INTRO.positioning}</p>
            <div className={styles.actionRow}>
              <a className={styles.primaryAction} href="#work">
                View selected work <span aria-hidden="true">↘</span>
              </a>
              <a className={styles.quietAction} href="#contact">
                Get in touch
              </a>
            </div>
          </div>
          <aside className={styles.heroAside} aria-label="Current focus">
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
          <div className={styles.aboutGrid}>
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
              >
                <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
                <div className={styles.rowMain}>
                  <p className={styles.rowMeta}>{project.meta}</p>
                  <h3 className={styles.rowTitle}>{project.title}</h3>
                  <p className={styles.rowSummary}>{project.summary}</p>
                  <div className={styles.tagList} aria-label="Technology stack">
                    {project.stack.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.rowAside}>
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
                <SceneFocus key={node.id} state={scene} article className={styles.researchRow} label={node.label}>
                  <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.rowMain}>
                    <p className={styles.rowMeta}>{node.meta}</p>
                    <h3 className={styles.rowTitle}>{node.title ?? node.label}</h3>
                    <p className={styles.rowSummary}>{node.summary}</p>
                  </div>
                  <div className={styles.rowAside}>
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
              <article key={item.id} className={styles.experienceRow}>
                <p className={styles.rowMeta}>{item.period}</p>
                <div>
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
                <SceneFocus key={group.title} state={group.scene} className={styles.capabilityGroup} label={group.title}>
                  <h3>{group.title}</h3>
                  <ul>
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
          <p className={styles.eyebrow}>05 / Contact</p>
          <h2 className="headline" id="contact-title">
            Open to careful questions and difficult visual problems.
          </h2>
          <p className={styles.contactLead}>{CONTACT.invitation}</p>
          <div className={styles.contactLinks}>
            {CONTACT.links.map((link) =>
              link.href ? (
                <a key={link.label} href={link.href} {...externalProps(link.href)}>
                  {link.label} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span key={link.label} className={styles.pendingLink}>
                  <span>{link.label}</span>
                  <small>{link.note}</small>
                </span>
              ),
            )}
          </div>
          <p className={styles.footerNote}>Alvin Luong · Computer vision research / engineering</p>
        </div>
      </section>
    </main>
  );
}
