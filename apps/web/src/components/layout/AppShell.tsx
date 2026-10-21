'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MobileNavProvider } from '@/components/layout/MobileNavContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // If on login page, skip loading screen and render immediately
    if (pathname === '/login') {
      setIsInitializing(false);
      return;
    }

    // Check authentication with /api/v1/auth/me or cookie/localStorage
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('updatepilot_user');
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();

        if (data.success && data.data?.user) {
          setIsAuthenticated(true);
          localStorage.setItem('updatepilot_user', JSON.stringify(data.data.user));
        } else if (storedUser) {
          // Fallback to stored session in dev
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.replace('/login');
          return;
        }
      } catch {
        // If error or offline, fallback to dev fixture session
        setIsAuthenticated(true);
      } finally {
        // Brief smooth timeout so the animated load screen displays gracefully
        setTimeout(() => {
          setIsInitializing(false);
        }, 650);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Login page layout (no sidebar)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Load screen with simple animation
  if (isInitializing) {
    return (
      <LoadingScreen
        message="Initializing Update Intelligence Engine..."
        subMessage="Validating host credentials and software catalogs"
      />
    );
  }

  // Protected App Layout
  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
          <main className="flex-1 pb-16">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
