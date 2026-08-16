import type { Metadata, Viewport } from 'next';
import { fontClassName } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Luong Quoc Khanh — Computer Vision Research & Engineering',
  description:
    'The portfolio of Luong Quoc Khanh: computer vision research, 3D vision, medical imaging, and research engineering.',
};

export const viewport: Viewport = {
  themeColor: '#F4F1EA',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClassName}>
      <body>{children}</body>
    </html>
  );
}
