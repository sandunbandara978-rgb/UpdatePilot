'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, RefreshCw, KeyRound, CheckCircle2, ShieldAlert, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMobileNav } from '@/components/layout/MobileNavContext';

export interface NavbarProps {
  onScanClick?: () => void;
  onConnectAgentClick?: () => void;
  isScanning?: boolean;
}

export function Navbar({ onScanClick, onConnectAgentClick, isScanning = false }: NavbarProps) {
  const [isDark, setIsDark] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null);
  const { toggle } = useMobileNav();

  useEffect(() => {
    // Check initial theme
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);

    // Fetch device status
    fetch('/api/v1/devices')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.devices.length > 0) {
          const hasOnline = data.data.devices.some((d: { status: string }) => d.status === 'ONLINE');
          setDeviceOnline(hasOnline);
        } else {
          setDeviceOnline(false);
        }
      })
      .catch(() => setDeviceOnline(false));
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left items: Mobile menu toggle + Status badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-border/60 bg-card/60">
          {deviceOnline ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-foreground">Windows Host Connected</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Local Agent Not Paired</span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onConnectAgentClick}
          className="gap-2 text-xs font-semibold"
        >
          <KeyRound className="h-3.5 w-3.5 text-brand-500" />
          <span className="hidden xs:inline">Connect Agent</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onScanClick}
          isLoading={isScanning}
          className="gap-2 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Scan Now</span>
        </Button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>

        <button
          onClick={async () => {
            try {
              await fetch('/api/v1/auth/logout', { method: 'POST' });
              localStorage.removeItem('updatepilot_user');
              window.location.href = '/login';
            } catch {
              window.location.href = '/login';
            }
          }}
          className="p-2 rounded-lg border border-border/60 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
