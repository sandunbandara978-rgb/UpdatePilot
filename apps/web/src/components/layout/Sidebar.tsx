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
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
              UpdatePilot
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                v1.0
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">Windows Intelligence</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/80">
          Platform
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform group-hover:scale-110',
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-border/60 bg-card/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-brand-500/20">
            LA
          </div>
          <div className="overflow-hidden">
            <span className="text-xs font-bold text-foreground block truncate">
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
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 border-r border-border z-30">
        <SidebarNavContent />
      </aside>

      {/* Mobile Drawer (Overlay + Drawer) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer Menu */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <SidebarNavContent onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}
