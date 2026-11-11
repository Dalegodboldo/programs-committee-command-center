import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programs Committee Command Center',
  description: 'Private dashboard for the AITCF Programs Committee',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
