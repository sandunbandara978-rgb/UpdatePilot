import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'UpdatePilot — Software Update Intelligence & Management Platform',
  description:
    'Industrial-quality Windows-first software update intelligence platform. Discover installed applications, inspect verified release metadata, and safely execute user-confirmed updates.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-brand-500 selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
