'use client';

import React from 'react';
import { Laptop, ShieldCheck } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function LoadingScreen({
  message = 'Initializing Update Intelligence Platform...',
  subMessage = 'Connecting to Windows Package Manager & Host Security Engine',
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground transition-all duration-500">
      {/* Ambient background glow */}
      <div className="absolute h-96 w-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute h-64 w-64 rounded-full bg-blue-600/10 blur-2xl pointer-events-none -top-10" />

      <div className="relative flex flex-col items-center max-w-sm text-center px-6 space-y-6">
        {/* Animated Brand Emblem */}
        <div className="relative flex items-center justify-center">
          {/* Outer Pulsing Rings */}
          <div className="absolute h-24 w-24 rounded-3xl border border-brand-500/30 animate-ping opacity-25" />
          <div className="absolute h-20 w-20 rounded-2xl border-2 border-brand-400/40 animate-pulse" />

          {/* Central Logo Box */}
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/30 relative z-10">
            <Laptop className="h-8 w-8 animate-bounce duration-1000" />
          </div>

          {/* Small security badge */}
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-background z-20 shadow-md">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Title & Brand */}
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            <span>UpdatePilot</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-500 dark:text-brand-400 border border-brand-500/30 uppercase tracking-wider">
              v1.0
            </span>
          </h2>
          <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 tracking-wide">
            {message}
          </p>
        </div>

        {/* Simple Animated Loading Bar */}
        <div className="w-56 space-y-2">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-brand-600 via-blue-400 to-emerald-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite] w-2/3" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {subMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
