'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ApplicationEntity, JobStatus } from '@updatepilot/shared';
import { ShieldAlert, ArrowRight, FileText, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface UpdatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: ApplicationEntity | null;
  onUpdateCompleted?: () => void;
}

export function UpdatePreviewModal({ isOpen, onClose, application, onUpdateCompleted }: UpdatePreviewModalProps) {
  const [preview, setPreview] = useState<{
    targetVersion: string;
    source: string;
    warnings: string[];
    metadata?: {
      releaseNotesUrl?: string;
      license?: string;
      sha256?: string;
      installerType?: string;
    };
  } | null>(null);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobLogs, setJobLogs] = useState<string | null>(null);

  // Load preview data when opened
  useEffect(() => {
    if (isOpen && application) {
      setIsLoadingPreview(true);
      setPreview(null);
      setHasConfirmed(false);
      setActiveJobId(null);
      setJobStatus(null);
      setJobLogs(null);

      fetch(`/api/v1/updates/${application.id}/preview`, { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPreview(data.data);
          }
        })
        .finally(() => setIsLoadingPreview(false));
    }
  }, [isOpen, application]);

  // Track job progress
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${activeJobId}`);
        const data = await res.json();
        if (data.success && data.data.job) {
          const currentStatus: JobStatus = data.data.job.status;
          const fullLogs = [data.data.job.executionOutput, data.data.job.verificationDetails]
            .filter(Boolean)
            .join('\n\n--- Verification Details ---\n');
          setJobLogs(fullLogs || null);

          if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED' || currentStatus === 'RESTART_REQUIRED') {
            clearInterval(interval);
            setIsExecuting(false);
            if (currentStatus === 'COMPLETED' && onUpdateCompleted) {
              onUpdateCompleted();
            }
          }
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJobId, onUpdateCompleted]);

  const handleExecute = async () => {
    if (!application || !preview || !hasConfirmed) return;
    setIsExecuting(true);
    setJobStatus('QUEUED');

    try {
      const res = await fetch(`/api/v1/updates/${application.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          acknowledgedTargetVersion: preview.targetVersion,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveJobId(data.data.jobId);
      } else {
        setIsExecuting(false);
        setJobStatus('FAILED');
        setJobLogs(data.error?.message || 'Update job authorization failed.');
      }
    } catch (err: unknown) {
      setIsExecuting(false);
      setJobStatus('FAILED');
      setJobLogs(err instanceof Error ? err.message : String(err));
    }
  };

  if (!application) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verified Software Update"
      description="Review package details, cryptographic sources, and authorize update execution."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Pre-flight Application Summary */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-foreground text-base">{application.name}</h4>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{application.packageId}</p>
            </div>
            <Badge status="UPDATE_AVAILABLE" />
          </div>

          <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-card border border-border/60">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Installed</span>
              <div className="font-mono text-sm font-medium text-foreground">{application.installedVersion}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-brand-500" />
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold">
                Target Version
              </span>
              <div className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                {preview?.targetVersion || application.availableVersion}
              </div>
            </div>
          </div>
        </div>

        {/* Verification Metadata */}
        {preview && !activeJobId && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-border/60 bg-card">
                <span className="text-muted-foreground font-medium">Source Manager:</span>
                <p className="font-semibold text-foreground mt-0.5 capitalize">{preview.source}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/60 bg-card">
                <span className="text-muted-foreground font-medium">Installer Type:</span>
                <p className="font-semibold text-foreground mt-0.5 uppercase">
                  {preview.metadata?.installerType || 'Standard Windows'}
                </p>
              </div>
            </div>

            {preview.metadata?.releaseNotesUrl && (
              <a
                href={preview.metadata.releaseNotesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/50 text-xs text-brand-600 dark:text-brand-400 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Official Release Notes & Changelog
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {preview.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Pre-flight Advisories</span>
                </div>
                {preview.warnings.map((w, idx) => (
                  <p key={idx} className="pl-5 text-[11px]">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            {/* Explicit Confirmation Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={hasConfirmed}
                  onChange={(e) => setHasConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    I explicitly authorize this update to version {preview.targetVersion}
                  </span>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    UpdatePilot will dispatch this job to your Windows agent. Results are verified before marking completion.
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!hasConfirmed || isExecuting}
                isLoading={isExecuting}
                onClick={handleExecute}
              >
                Execute Confirmed Update
              </Button>
            </div>
          </div>
        )}

        {/* Live Execution Progress Stepper */}
        {activeJobId && (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Job Lifecycle
              </span>
              <Badge status={jobStatus || 'QUEUED'} />
            </div>

            {/* Progress indicators */}
            <div className="space-y-3">
              {[
                { status: 'QUEUED', label: 'Authorized & Queued in Database' },
                { status: 'CLAIMED', label: 'Claimed by Windows Desktop Agent' },
                { status: 'RUNNING', label: 'WinGet Executing Verified Upgrade' },
                { status: 'VERIFYING', label: 'Inspecting Host Application Version' },
                { status: 'COMPLETED', label: 'Update Verified & Audit Trail Recorded' },
              ].map((step, idx) => {
                const isStepPassed =
                  jobStatus === step.status ||
                  (jobStatus === 'CLAIMED' && idx <= 1) ||
                  (jobStatus === 'RUNNING' && idx <= 2) ||
                  (jobStatus === 'VERIFYING' && idx <= 3) ||
                  (jobStatus === 'COMPLETED' && idx <= 4);

                return (
                  <div key={step.status} className="flex items-center gap-3 text-xs">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isStepPassed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={isStepPassed ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Diagnostic Logs Output */}
            {jobLogs && (
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 max-h-40">
                <pre className="whitespace-pre-wrap">{jobLogs}</pre>
              </div>
            )}

            {jobStatus === 'COMPLETED' && (
              <div className="text-center pt-2">
                <Button variant="primary" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            )}

            {jobStatus === 'FAILED' && (
              <div className="text-center pt-2">
                <Button variant="destructive" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
