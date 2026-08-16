import type { Metadata, Viewport } from 'next';
import { fontClassName } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Learning How to See',
  description:
    'A continuous account of one question — how a machine learns to see — and the work that came out of asking it.',
};

export const viewport: Viewport = {
  themeColor: '#05070C',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClassName}>
      <body>{children}</body>
    </html>
  );
}
