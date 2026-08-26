import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Echelon Protocol | AI-Powered DeFi Lending',
  description: 'Autonomous multi-agent risk sentinel on Base',
  icons: {
    icon: '/icon-removebg-preview.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="6a8f08e3600b1b49edbb62cb" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}