import './globals.css';
import type { Metadata } from 'next';

// The site's public address, used for link previews.
const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://programs-committee.alwaysintheclub.org';

const title = 'Programs Committee Command Center';
const description = 'Always In The Club Foundation. Action items, meetings, Spotlight, mentoring and documents for the Programs Committee. Private, board members only.';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: 'Always In The Club Foundation',
    title,
    description,
    url: '/',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AITCF Programs Committee Command Center' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
