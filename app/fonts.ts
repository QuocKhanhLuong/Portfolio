import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google';

/**
 * Three roles, three faces, no more.
 *
 * Newsreader is the narrative voice: a humanist serif with a true optical-size
 * axis, so type re-optimizes as it scales through the acts. Low enough contrast
 * to survive a near-black ground, which rules out the obvious display serifs.
 *
 * Plex Sans carries body copy and Plex Mono carries system chrome — one
 * superfamily, so the serif is the only face with personality.
 */
export const serif = Newsreader({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-serif',
  // Next has no metric overrides for Newsreader; declare the fallback stack
  // explicitly rather than let it guess and warn on every build.
  adjustFontFallback: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const sans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-sans',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-mono',
});

export const fontClassName = `${serif.variable} ${sans.variable} ${mono.variable}`;
