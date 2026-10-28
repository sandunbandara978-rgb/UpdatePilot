'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  ArrowUpCircle,
  ShieldCheck,
  History,
  Settings,
  Laptop,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileNav } from '@/components/layout/MobileNavContext';

const navItems = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Fleet Computers', href: '/devices', icon: Laptop },
  { name: 'Applications', href: '/applications', icon: Layers },
  { name: 'Update Center', href: '/updates', icon: ArrowUpCircle },
  { name: 'Security Insights', href: '/security', icon: ShieldCheck },
  { name: 'History & Logs', href: '/history', icon: History },
  { name: 'Settings & Agent', href: '/settings', icon: Settings },
];

function SidebarNavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white/80 dark:bg-[#161617]/85 backdrop-blur-2xl border-r border-border/70 select-none">
      {/* macOS Traffic Lights Bar */}
      <div className="pt-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer" title="macOS Window Controls">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 shadow-inner group-hover:opacity-80 transition-opacity" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 shadow-inner group-hover:opacity-80 transition-opacity" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 shadow-inner group-hover:opacity-80 transition-opacity" />
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-6 mt-1 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 rounded-xl bg-gradient-to-b from-[#0071e3] to-[#005bb5] flex items-center justify-center text-white shadow-sm shadow-brand-500/25 overflow-hidden">
            <Laptop className="h-4 w-4 text-white" />
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-apple-shimmer pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-1.5">
              UpdatePilot
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                macOS
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">Host Intelligence</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
          Workspace
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-neutral-900/5 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-900/[0.03] dark:hover:bg-white/[0.05]'
              )}
            >
              {/* Subtle active pill accent */}
              {isActive && (
                <div className="absolute left-1 h-3.5 w-1 rounded-full bg-[#0071e3] dark:bg-white" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform duration-200 group-hover:scale-105 ml-1',
                  isActive
                    ? 'text-[#0071e3] dark:text-white'
                    : 'text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-border/50 bg-white/40 dark:bg-black/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-100 dark:from-neutral-700 dark:to-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-semibold text-xs flex-shrink-0 border border-black/5 dark:border-white/10 shadow-sm">
            LA
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-semibold text-foreground block truncate">
              Local Administrator
            </span>
            <span className="text-[10px] text-muted-foreground block truncate">
              admin@updatepilot.local
            </span>
          </div>
        </div>
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
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-30">
        <SidebarNavContent />
      </aside>

      {/* Mobile Drawer (Overlay + Drawer) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer Menu */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <SidebarNavContent onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}
