'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MobileNavProvider } from '@/components/layout/MobileNavContext';
import { DeviceProvider } from '@/components/layout/DeviceContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPlayingAppleAnimation, setIsPlayingAppleAnimation] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Listen for custom trigger to replay Apple Mac boot animation anytime
    const handleTrigger = () => {
      setIsPlayingAppleAnimation(true);
    };
    window.addEventListener('trigger-apple-animation', handleTrigger);
    return () => window.removeEventListener('trigger-apple-animation', handleTrigger);
  }, []);

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
        // If error or offline, fallback to dev session
        setIsAuthenticated(true);
      } finally {
        // Graceful duration so the Apple Mac loading animation plays smoothly
        setTimeout(() => {
          setIsInitializing(false);
        }, 850);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Login page layout (no sidebar)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Apple Mac Style Boot / Loading screen
  if (isInitializing || isPlayingAppleAnimation) {
    return (
      <LoadingScreen
        message="UpdatePilot macOS Intelligence"
        subMessage="Validating host credentials & WinGet catalog"
        onFinish={() => {
          setIsInitializing(false);
          setIsPlayingAppleAnimation(false);
        }}
      />
    );
  }

  // Protected App Layout
  return (
    <DeviceProvider>
      <MobileNavProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
            <main className="flex-1 pb-16">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </DeviceProvider>
  );
}
