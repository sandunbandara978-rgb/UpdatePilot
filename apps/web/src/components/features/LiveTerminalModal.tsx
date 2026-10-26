'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { JobStatus } from '@updatepilot/shared';
import {
  Terminal,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Laptop,
} from 'lucide-react';

interface LiveTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  appTitle?: string;
  packageId?: string;
  targetVersion?: string;
  deviceName?: string;
  onCompleted?: () => void;
}

export function LiveTerminalModal({
  isOpen,
  onClose,
  jobId,
  appTitle,
  packageId,
  targetVersion,
  deviceName,
  onCompleted,
}: LiveTerminalModalProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [output, setOutput] = useState<string>('');
  const [verificationDetails, setVerificationDetails] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll job details
  useEffect(() => {
    if (!isOpen || !jobId) {
      setJobStatus(null);
      setOutput('');
      setVerificationDetails(null);
      return;
    }

    let isMounted = true;
    setIsPolling(true);

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}`);
        const data = await res.json();
        if (isMounted && data.success && data.data?.job) {
          const job = data.data.job;
          setJobStatus(job.status);
          setOutput(job.executionOutput || 'WinGet process dispatched to local executor...');
          setVerificationDetails(job.verificationDetails || null);

          if (
            job.status === 'COMPLETED' ||
            job.status === 'FAILED' ||
            job.status === 'RESTART_REQUIRED'
          ) {
            setIsPolling(false);
            if (job.status === 'COMPLETED' && onCompleted) {
              onCompleted();
            }
            return false; // Stop polling
          }
        }
      } catch (err) {
        console.error('Terminal polling error:', err);
      }
      return true;
    };

    poll();
    const interval = setInterval(async () => {
      const keepGoing = await poll();
      if (!keepGoing) {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, jobId, onCompleted]);

  // Auto-scroll to end of logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, verificationDetails]);

  const handleCopyLogs = () => {
    const fullText = `=== UpdatePilot WinGet Execution Log ===\nPackage: ${packageId || appTitle}\nTarget Version: ${targetVersion}\nStatus: ${jobStatus}\n\n[OUTPUT]:\n${output}\n\n[VERIFICATION]:\n${verificationDetails || 'None'}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isCompleted = jobStatus === 'COMPLETED';
  const isFailed = jobStatus === 'FAILED';
  const isRestartRequired = jobStatus === 'RESTART_REQUIRED';
  const isRunning = jobStatus === 'RUNNING' || jobStatus === 'VERIFYING' || jobStatus === 'QUEUED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Live Execution Console"
      description="Real-time output stream from Windows Package Manager (WinGet) execution engine."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Header Info Banner */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{appTitle || 'Software Package'}</span>
              {targetVersion && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  Target: v{targetVersion}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{packageId || 'Package ID'}</span>
              {deviceName && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-foreground font-sans">
                    <Laptop className="h-3 w-3 text-brand-500" />
                    {deviceName}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge status={jobStatus || 'QUEUED'} />
            {isPolling && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Verification Summary Chip */}
        {verificationDetails && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
              isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : isFailed
                ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : isFailed ? (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
            )}
            <span className="font-medium font-mono">{verificationDetails}</span>
          </div>
        )}

        {/* Terminal Window */}
        <div className="rounded-xl overflow-hidden border border-border/80 bg-slate-950 dark:bg-black shadow-2xl">
          {/* Top terminal bar */}
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/80 inline-block" />
              <span className="text-[11px] font-mono text-slate-400 ml-2 flex items-center gap-1.5">
                <Terminal className="h-3 w-3 text-brand-400" />
                <span>winget.exe execution stream</span>
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLogs}
              className="h-6 px-2 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 gap-1"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy Logs'}</span>
            </Button>
          </div>

          {/* Terminal log output */}
          <div className="p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-1 selection:bg-brand-500/30 selection:text-white leading-relaxed">
            {output ? (
              output.split(/\r?\n/).map((line, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-600 select-none w-6 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span
                    className={
                      line.toLowerCase().includes('successfully installed') ||
                      line.toLowerCase().includes('verified')
                        ? 'text-emerald-400 font-semibold'
                        : line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
                        ? 'text-red-400 font-semibold'
                        : line.toLowerCase().includes('downloading') || line.toLowerCase().includes('starting')
                        ? 'text-blue-400'
                        : 'text-slate-300'
                    }
                  >
                    {line}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic py-8 text-center flex flex-col items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-brand-400" />
                <span>Initializing WinGet process and loading manifest...</span>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {isRunning && (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Update is currently executing in background...
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Software has been successfully updated and verified!
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Update failed. Review logs above for details.
              </span>
            )}
          </div>

          <Button variant={isCompleted ? 'primary' : 'outline'} size="sm" onClick={onClose}>
            {isCompleted ? 'Done' : 'Close Console'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
