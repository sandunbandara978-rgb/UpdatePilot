import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'UpdatePilot â€” Software Update Intelligence & Management Platform',
  description:
    'Industrial-quality software update intelligence platform with Apple macOS-inspired aesthetics. Discover installed applications, inspect verified release metadata, and safely execute user-confirmed updates.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('updatepilot_theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-[#0071e3] selection:text-white transition-colors duration-300">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
