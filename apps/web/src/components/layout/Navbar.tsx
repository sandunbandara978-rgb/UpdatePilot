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
  Server,
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
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
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
      {/* Left items: Mobile menu toggle + Device Fleet Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Multi-computer Fleet Selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Laptop className="absolute left-2.5 h-3.5 w-3.5 text-brand-500 pointer-events-none" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="text-xs font-semibold pl-8 pr-7 py-1.5 rounded-lg border border-border/70 bg-card/80 text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-sm"
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
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/60 bg-card/60">
            {hasOnline ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
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
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onConnectAgentClick}
          className="gap-2 text-xs font-semibold"
        >
          <KeyRound className="h-3.5 w-3.5 text-brand-500" />
          <span className="hidden xs:inline">Connect Computer</span>
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
          aria-label="Toggle visual theme"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
}
