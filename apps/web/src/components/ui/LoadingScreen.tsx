'use client';

import React, { useState, useEffect } from 'react';
import { Laptop, Sparkles, Check, ShieldCheck } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  onFinish?: () => void;
}

export function LoadingScreen({
  message = 'Initializing Update Intelligence Platform...',
  subMessage = 'Connecting to Windows Package Manager & Host Security Engine',
  onFinish,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(12);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phases = [
    'Connecting to Windows host runtime...',
    'Verifying software catalog integrity...',
    'Synchronizing upstream WinGet feeds...',
    'System ready.',
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(45);
      setPhaseIndex(1);
    }, 200);

    const timer2 = setTimeout(() => {
      setProgress(78);
      setPhaseIndex(2);
    }, 450);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setPhaseIndex(3);
    }, 650);

    const timer4 = setTimeout(() => {
      if (onFinish) onFinish();
    }, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fbfbfd] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors duration-500 overflow-hidden select-none">
      {/* Apple Studio Ambient Lighting (Subtle diffused glow) */}
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-400/8 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-indigo-400/6 to-transparent blur-3xl pointer-events-none" />

      {/* Floating Mac Window Surface */}
      <div className="relative w-[92%] max-w-md mx-auto p-8 sm:p-10 rounded-[32px] bg-white/80 dark:bg-[#161617]/85 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.1] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] flex flex-col items-center text-center animate-apple-fade-in">
        {/* macOS Window Traffic Lights */}
        <div className="absolute top-5 left-6 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/30 shadow-inner" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/30 shadow-inner" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/30 shadow-inner" />
        </div>

        {/* Top subtle macOS Window Label */}
        <div className="absolute top-4 text-[11px] font-medium tracking-tight text-neutral-400 dark:text-neutral-500 hidden sm:block">
          macOS Native Experience
        </div>

        {/* Central Apple-style Squircle Emblem */}
        <div className="relative mt-3 mb-6">
          <div className="relative h-20 w-20 rounded-[24px] bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 border border-black/[0.08] dark:border-white/[0.12] shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,1)] flex items-center justify-center text-neutral-900 dark:text-white overflow-hidden group">
            {/* Apple Specular Shimmer Ray */}
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent -skew-x-12 animate-apple-shimmer pointer-events-none" />

            <Laptop className="h-9 w-9 text-[#0071e3] transition-transform duration-500 group-hover:scale-105" />

            {/* Micro verification badge */}
            <div className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full bg-[#34c759] text-white flex items-center justify-center shadow-sm">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </div>
          </div>

          {/* Gentle breathing ring */}
          <div className="absolute -inset-2 rounded-[30px] border border-[#0071e3]/20 animate-apple-breathe pointer-events-none" />
        </div>

        {/* Typography */}
        <div className="space-y-1.5 mb-7">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              UpdatePilot
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-black/[0.06] dark:border-white/[0.08] tracking-wider uppercase">
              PRO
            </span>
          </div>
          <p className="text-xs font-normal text-neutral-500 dark:text-neutral-400 max-w-xs">
            {subMessage}
          </p>
        </div>

        {/* Apple Minimalist Progress Bar */}
        <div className="w-64 space-y-3">
          <div className="h-1.5 w-full bg-black/[0.06] dark:bg-white/[0.12] rounded-full overflow-hidden p-[1px] relative">
            <div
              className="h-full bg-[#0071e3] dark:bg-white rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative"
              style={{ width: `${progress}%` }}
            >
              {/* Subtle trailing light gleam */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/80 rounded-full blur-[1px]" />
            </div>
          </div>

          {/* Dynamic Stage Feedback with Apple-style subtle fade */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
            <span className="transition-opacity duration-300">
              {phases[phaseIndex]}
            </span>
            <span className="tabular-nums font-mono text-[10px]">
              {progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
