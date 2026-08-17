import type { Metadata, Viewport } from 'next';
import { fontClassName } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lương Quốc Khánh — Computer Vision Research & Engineering',
  description:
    'Reading station & portfolio of Lương Quốc Khánh: computer vision research, 3D vision, medical imaging, and representation learning.',
};

export const viewport: Viewport = {
  themeColor: '#0C0E0D',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClassName}>
      <body>{children}</body>
    </html>
  );
}
