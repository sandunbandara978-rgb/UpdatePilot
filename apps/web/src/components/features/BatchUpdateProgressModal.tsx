'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ApplicationEntity, JobStatus } from '@updatepilot/shared';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Laptop,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface AppUpdateProgressItem {
  app: ApplicationEntity;
  jobId: string | null;
  status: 'PENDING' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
  progress: number; // 0 to 100
  phase: string;
  verifiedVersion?: string;
  error?: string;
  logs?: string;
}

interface BatchUpdateProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  appsToUpdate: ApplicationEntity[];
  deviceName?: string;
  onAllCompleted?: () => void;
}

export function BatchUpdateProgressModal({
  isOpen,
  onClose,
  appsToUpdate,
  deviceName = 'This PC',
  onAllCompleted,
}: BatchUpdateProgressModalProps) {
  const [items, setItems] = useState<AppUpdateProgressItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [activeLogs, setActiveLogs] = useState<string>('');
  const isCancelledRef = useRef<boolean>(false);

  // Initialize items whenever appsToUpdate changes
  useEffect(() => {
    if (!isOpen || appsToUpdate.length === 0) return;

    const initialItems: AppUpdateProgressItem[] = appsToUpdate.map((app) => ({
      app,
      jobId: null,
      status: 'PENDING',
      progress: 0,
      phase: 'Waiting in queue...',
    }));

    setItems(initialItems);
    setCurrentIndex(0);
    setIsProcessing(true);
    setIsPaused(false);
    isCancelledRef.current = false;
  }, [isOpen, appsToUpdate]);

  // Overall batch percentage calculation
  const totalApps = items.length;
  const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
  const failedCount = items.filter((i) => i.status === 'FAILED').length;

  const currentItem = items[currentIndex];
  const currentAppProgress = currentItem?.progress || 0;

  const overallPercentage = totalApps === 0
    ? 0
    : Math.min(
        100,
        Math.round(
          ((completedCount + failedCount + (currentItem?.status === 'RUNNING' ? currentAppProgress / 100 : 0)) /
            totalApps) *
            100
        )
      );

  // Sequential execution engine
  useEffect(() => {
    if (!isProcessing || isPaused || items.length === 0) return;
    if (currentIndex >= items.length) {
      setIsProcessing(false);
      if (onAllCompleted) onAllCompleted();
      return;
    }

    let isSubscribed = true;
    const item = items[currentIndex];

    // If already completed or failed, move to next
    if (item.status === 'COMPLETED' || item.status === 'FAILED') {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    const runSingleAppUpdate = async () => {
      // 1. Dispatch update job to server
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === currentIndex
            ? { ...it, status: 'RUNNING', progress: 15, phase: 'Authorizing update & resolving manifest...' }
            : it
        )
      );

      try {
        const res = await fetch(`/api/v1/updates/${item.app.id}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmed: true,
            acknowledgedTargetVersion: item.app.availableVersion,
          }),
        });

        const data = await res.json();
        if (!data.success || !data.data?.jobId) {
          throw new Error(data.error?.message || 'Failed to dispatch update request.');
        }

        const jobId = data.data.jobId;

        if (!isSubscribed) return;

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === currentIndex
              ? {
                  ...it,
                  jobId,
                  progress: 25,
                  phase: 'WinGet executing package upgrade in background...',
                }
              : it
          )
        );

        // 2. Poll job until completion or error
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          if (!isSubscribed || isCancelledRef.current) {
            clearInterval(pollInterval);
            return;
          }

          pollCount++;
          try {
            const jobRes = await fetch(`/api/v1/jobs/${jobId}`);
            const jobData = await jobRes.json();

            if (jobData.success && jobData.data?.job) {
              const job = jobData.data.job;
              const rawLogs = job.executionOutput || '';
              setActiveLogs(rawLogs);

              if (job.status === 'RUNNING') {
                // Smooth progressive simulated percentage while downloading/installing
                const runningProgress = Math.min(85, 25 + pollCount * 6);
                let phaseDesc = 'Downloading verified installer package...';
                if (runningProgress > 50) phaseDesc = 'Executing package installer...';
                if (runningProgress > 70) phaseDesc = 'Applying updates & configurations...';

                setItems((prev) =>
                  prev.map((it, idx) =>
                    idx === currentIndex
                      ? {
                          ...it,
                          progress: runningProgress,
                          phase: phaseDesc,
                          logs: rawLogs,
                        }
                      : it
                  )
                );
              } else if (job.status === 'VERIFYING') {
                setItems((prev) =>
                  prev.map((it, idx) =>
                    idx === currentIndex
                      ? {
                          ...it,
                          status: 'VERIFYING',
                          progress: 92,
                          phase: 'Verifying installed registry version...',
                          logs: rawLogs,
                        }
                      : it
                  )
                );
              } else if (job.status === 'COMPLETED') {
                clearInterval(pollInterval);
                setItems((prev) =>
                  prev.map((it, idx) =>
                    idx === currentIndex
                      ? {
                          ...it,
                          status: 'COMPLETED',
                          progress: 100,
                          phase: `Successfully updated to v${it.app.availableVersion}!`,
                          verifiedVersion: it.app.availableVersion || undefined,
                          logs: rawLogs,
                        }
                      : it
                  )
                );

                // Small pause so user sees 100% completion before advancing
                setTimeout(() => {
                  if (isSubscribed) setCurrentIndex((prev) => prev + 1);
                }, 900);
              } else if (job.status === 'FAILED' || job.status === 'CANCELLED') {
                clearInterval(pollInterval);
                setItems((prev) =>
                  prev.map((it, idx) =>
                    idx === currentIndex
                      ? {
                          ...it,
                          status: 'FAILED',
                          progress: 100,
                          phase: 'Update failed or encountered an error.',
                          error: job.verificationDetails || 'WinGet process failed.',
                          logs: rawLogs,
                        }
                      : it
                  )
                );

                setTimeout(() => {
                  if (isSubscribed) setCurrentIndex((prev) => prev + 1);
                }, 1200);
              }
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
          }
        }, 1200);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === currentIndex
              ? {
                  ...it,
                  status: 'FAILED',
                  progress: 100,
                  phase: `Error: ${errorMsg}`,
                  error: errorMsg,
                }
              : it
          )
        );
        setTimeout(() => {
          if (isSubscribed) setCurrentIndex((prev) => prev + 1);
        }, 1200);
      }
    };

    runSingleAppUpdate();

    return () => {
      isSubscribed = false;
    };
  }, [currentIndex, isProcessing, isPaused, items.length, onAllCompleted]);

  if (!isOpen) return null;

  const isAllFinished = completedCount + failedCount === totalApps && totalApps > 0;

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Floating Apple macOS Window */}
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-[#161617]/95 backdrop-blur-2xl rounded-[28px] border border-black/[0.08] dark:border-white/[0.12] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* macOS Window Top Chrome */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.05] dark:border-white/[0.08] bg-white/50 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <div
              onClick={handleCancel}
              className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 shadow-inner cursor-pointer hover:opacity-80"
              title="Close window"
            />
            <div
              onClick={() => setIsPaused((p) => !p)}
              className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 shadow-inner cursor-pointer hover:opacity-80"
              title={isPaused ? "Resume updates" : "Pause updates"}
            />
            <div
              className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 shadow-inner cursor-pointer hover:opacity-80"
              title="Full view"
            />
          </div>

          <div className="text-xs font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#0071e3]" />
            <span>UpdatePilot Software Update Center</span>
          </div>

          <button
            onClick={handleCancel}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
          {/* Main Percentage Showcase Banner */}
          <div className="p-6 rounded-[22px] bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900/60 dark:to-neutral-900/20 border border-black/[0.05] dark:border-white/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
            {/* Subtle background shine */}
            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 dark:via-white/5 to-transparent -skew-x-12 animate-apple-shimmer pointer-events-none" />

            <div className="space-y-1.5 relative z-10">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 block">
                {isAllFinished ? 'All Updates Completed' : isPaused ? 'Updates Paused' : 'Live Update Progress'}
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {isAllFinished
                  ? `Successfully finished updating ${completedCount} software package${completedCount === 1 ? '' : 's'}!`
                  : `Updating each software on ${deviceName}...`}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isAllFinished
                  ? 'All packages verified and up-to-date in your system inventory.'
                  : `Package ${Math.min(currentIndex + 1, totalApps)} of ${totalApps} in progress`}
              </p>
            </div>

            {/* Giant Apple Percentage Display */}
            <div className="flex flex-col items-center sm:items-end justify-center relative z-10 flex-shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#0071e3] tabular-nums">
                  {overallPercentage}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#0071e3]/80">%</span>
              </div>
              <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                Overall Progress
              </span>
            </div>
          </div>

          {/* Master Progress Bar */}
          <div className="space-y-2">
            <div className="h-2 w-full bg-black/[0.06] dark:bg-white/[0.1] rounded-full overflow-hidden p-[1px] relative">
              <div
                className="h-full bg-[#0071e3] rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative"
                style={{ width: `${overallPercentage}%` }}
              >
                {/* Glowing leading edge */}
                <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/70 rounded-full blur-[1px]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5 font-medium">
                {completedCount > 0 && (
                  <span className="text-[#34c759] font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completedCount} Completed
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="text-[#ff3b30] font-bold flex items-center gap-1 ml-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {failedCount} Failed
                  </span>
                )}
              </span>
              <span className="font-mono text-xs">
                {completedCount + failedCount} / {totalApps} Software
              </span>
            </div>
          </div>

          {/* Currently Active Software Spotlight */}
          {!isAllFinished && currentItem && (
            <div className="p-4 rounded-[18px] bg-[#0071e3]/[0.04] dark:bg-[#0071e3]/[0.08] border border-[#0071e3]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-[#0071e3]/15 text-[#0071e3] flex items-center justify-center">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      Currently Updating: {currentItem.app.name}
                    </h4>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {currentItem.app.installedVersion} → {currentItem.app.availableVersion}
                    </span>
                  </div>
                </div>

                {/* Single Item Percentage */}
                <div className="flex items-center gap-1 text-xs font-bold text-[#0071e3] tabular-nums font-mono">
                  <span>{currentItem.progress}</span>
                  <span>%</span>
                </div>
              </div>

              {/* Single Item Progress Bar */}
              <div className="h-1.5 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0071e3] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${currentItem.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>{currentItem.phase}</span>
                <span className="text-[10px] font-mono opacity-70">Package ID: {currentItem.app.packageId}</span>
              </div>
            </div>
          )}

          {/* Software Queue List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Software Update Queue ({totalApps})
            </h3>

            <div className="rounded-[18px] border border-black/[0.06] dark:border-white/[0.08] bg-white/60 dark:bg-black/20 divide-y divide-black/[0.04] dark:divide-white/[0.06] max-h-56 overflow-y-auto">
              {items.map((it, idx) => {
                const isCurrent = idx === currentIndex && !isAllFinished;
                const isDone = it.status === 'COMPLETED';
                const isFail = it.status === 'FAILED';

                return (
                  <div
                    key={it.app.id}
                    className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-[#0071e3]/[0.05] font-semibold'
                        : isDone
                        ? 'opacity-85'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex-shrink-0">
                        {isDone ? (
                          <div className="h-6 w-6 rounded-full bg-[#34c759] text-white flex items-center justify-center shadow-sm">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : isFail ? (
                          <div className="h-6 w-6 rounded-full bg-[#ff3b30] text-white flex items-center justify-center shadow-sm">
                            <X className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : isCurrent ? (
                          <div className="h-6 w-6 rounded-full bg-[#0071e3] text-white flex items-center justify-center shadow-sm">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="text-xs text-neutral-900 dark:text-neutral-100 block truncate font-medium">
                          {it.app.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          v{it.app.installedVersion} → v{it.app.availableVersion}
                        </span>
                      </div>
                    </div>

                    {/* Progress status pill */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isDone ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#34c759]/10 text-[#34c759] text-[11px] font-bold font-mono">
                          100%
                        </span>
                      ) : isFail ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] text-[11px] font-bold">
                          Failed
                        </span>
                      ) : isCurrent ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-bold font-mono flex items-center gap-1">
                          <span className="animate-pulse">●</span> {it.progress}%
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 text-[11px] font-medium font-mono">
                          0%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Live Terminal Logs Collapsible */}
          {activeLogs && (
            <div className="space-y-2">
              <button
                onClick={() => setShowLogs((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Live WinGet Execution Output</span>
                {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showLogs && (
                <div className="p-3.5 rounded-xl bg-neutral-950 text-neutral-300 font-mono text-[11px] max-h-36 overflow-y-auto leading-relaxed border border-neutral-800 shadow-inner">
                  <pre className="whitespace-pre-wrap">{activeLogs}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/60 dark:bg-black/30">
          <div className="flex items-center gap-2">
            {!isAllFinished && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused((p) => !p)}
                className="text-xs rounded-full font-medium"
              >
                {isPaused ? 'Resume Updates' : 'Pause Updates'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAllFinished ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                className="rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-5 text-xs font-semibold shadow-sm"
              >
                Done
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="rounded-full text-xs"
              >
                Cancel Remaining
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

