'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  ShieldAlert,
  Menu,
  Laptop,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMobileNav } from '@/components/layout/MobileNavContext';
import { useDeviceContext } from '@/components/layout/DeviceContext';

export interface NavbarProps {
  onScanClick?: () => void;
  onConnectAgentClick?: () => void;
  isScanning?: boolean;
}

export function Navbar({ onScanClick, onConnectAgentClick, isScanning = false }: NavbarProps) {
  const [isDark, setIsDark] = useState(false);
  const { toggle } = useMobileNav();
  const { devices, selectedDeviceId, setSelectedDeviceId } = useDeviceContext();

  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');
  const hasOnline = onlineDevices.length > 0;

  useEffect(() => {
    const savedTheme = localStorage.getItem('updatepilot_theme');
    const isDarkMode = savedTheme === 'dark';
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('updatepilot_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('updatepilot_theme', 'dark');
      setIsDark(true);
    }
  };

  const triggerAppleAnimation = () => {
    window.dispatchEvent(new CustomEvent('trigger-apple-animation'));
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-black/[0.05] dark:border-white/[0.08] bg-white/75 dark:bg-[#161617]/75 px-4 sm:px-6 backdrop-blur-xl select-none transition-colors duration-300">
      {/* Left items: Mobile menu toggle + Device Fleet Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-xl border border-black/[0.08] dark:border-white/[0.1] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Multi-computer Fleet Selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Laptop className="absolute left-2.5 h-3.5 w-3.5 text-[#0071e3] pointer-events-none" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="text-xs font-medium pl-8 pr-7 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-[#202022] text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0071e3] shadow-sm hover:border-black/20 dark:hover:border-white/25 transition-all"
              title="Select computer to inspect"
            >
              <option value="ALL">
                🖥️ All Computers ({devices.length} {devices.length === 1 ? 'Host' : 'Hosts'})
              </option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.status === 'ONLINE' ? '🟢' : '⚪'} {d.deviceName}
                </option>
              ))}
            </select>
          </div>

          {/* Fleet Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-black/[0.06] dark:border-white/[0.1] bg-white/60 dark:bg-[#202022]/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            {hasOnline ? (
              <>
                <div className="h-2 w-2 rounded-full bg-[#34c759] animate-pulse" />
                <span className="text-foreground">
                  {onlineDevices.length} {onlineDevices.length === 1 ? 'Host' : 'Hosts'} Online
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3 w-3 text-amber-500" />
                <span className="text-muted-foreground">No Hosts Online</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Apple Mac Animation Replay Trigger */}
        <button
          onClick={triggerAppleAnimation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 hover:bg-neutral-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 border border-black/[0.06] dark:border-white/[0.1] shadow-sm transition-all duration-200 active:scale-95 group"
          title="Play Apple macOS Boot Animation"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#0071e3] group-hover:rotate-12 transition-transform duration-300" />
          <span className="hidden sm:inline">Mac Animation</span>
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={onConnectAgentClick}
          className="gap-2 text-xs font-medium rounded-full border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-transparent shadow-sm hover:shadow transition-all"
        >
          <KeyRound className="h-3.5 w-3.5 text-[#0071e3]" />
          <span className="hidden xs:inline">Connect Host</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onScanClick}
          isLoading={isScanning}
          className="gap-2 text-xs font-medium rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm hover:shadow transition-all active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Scan Now</span>
        </Button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-muted-foreground hover:text-foreground transition-all active:scale-90 shadow-sm"
          aria-label="Toggle visual theme"
          title={isDark ? "Switch to Apple Clean White" : "Switch to Dark Mode"}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-700" />
          )}
        </button>
      </div>
    </header>
  );
}
