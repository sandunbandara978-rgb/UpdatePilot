'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MobileNavProvider } from '@/components/layout/MobileNavContext';
import { DeviceProvider } from '@/components/layout/DeviceContext';
import { AuthProvider, ClientSessionUser } from '@/components/layout/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPlayingBootSplash, setIsPlayingBootSplash] = useState(false);
  const [currentUser, setCurrentUser] = useState<ClientSessionUser | null>(null);

  useEffect(() => {
    const handleTrigger = () => {
      setIsPlayingBootSplash(true);
    };
    window.addEventListener('trigger-apple-animation', handleTrigger);
    return () => window.removeEventListener('trigger-apple-animation', handleTrigger);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // continue redirect regardless
    }
    localStorage.removeItem('updatepilot_user');
    setCurrentUser(null);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (pathname === '/login') {
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { cache: 'no-store' });
        const data = await res.json();

        if (cancelled) return;

        if (res.ok && data.success && data.data?.user) {
          setCurrentUser(data.data.user);
          localStorage.setItem('updatepilot_user', JSON.stringify(data.data.user));
          setTimeout(() => {
            if (!cancelled) setIsInitializing(false);
          }, 450);
        } else {
          localStorage.removeItem('updatepilot_user');
          setCurrentUser(null);
          setIsInitializing(false);
          router.replace('/login');
        }
      } catch {
        if (cancelled) return;
        localStorage.removeItem('updatepilot_user');
        setCurrentUser(null);
        setIsInitializing(false);
        router.replace('/login');
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (isInitializing || isPlayingBootSplash) {
    return (
      <LoadingScreen
        message="UpdatePilot Host Intelligence"
        subMessage="Validating session & WinGet catalog"
        onFinish={() => {
          if (currentUser) setIsInitializing(false);
          setIsPlayingBootSplash(false);
        }}
      />
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <AuthProvider user={currentUser} logout={logout}>
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
    </AuthProvider>
  );
}
