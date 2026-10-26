'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LiveTerminalModal } from '@/components/features/LiveTerminalModal';
import { UpdatePreviewModal } from '@/components/features/UpdatePreviewModal';
import { ApplicationEntity, DeviceEntity, JobStatus } from '@updatepilot/shared';
import {
  ArrowUpCircle,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Laptop,
  Terminal,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  CheckSquare,
  Square,
  RotateCw,
  Eye,
} from 'lucide-react';

interface OutdatedSoftwareHubProps {
  devices: DeviceEntity[];
  selectedDeviceId?: string;
  onDeviceChange?: (deviceId: string) => void;
  onUpdated?: () => void;
  compactView?: boolean;
}

interface ActiveJobInfo {
  jobId: string;
  applicationId: string;
  status: JobStatus;
  packageId: string;
  targetVersion: string;
  appName: string;
  deviceName?: string;
}

export function OutdatedSoftwareHub({
  devices,
  selectedDeviceId = 'ALL',
  onDeviceChange,
  onUpdated,
  compactView = false,
}: OutdatedSoftwareHubProps) {
  const [updates, setUpdates] = useState<ApplicationEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());

  // Active update tracking
  const [activeJobs, setActiveJobs] = useState<Record<string, ActiveJobInfo>>({}); // keyed by applicationId
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals state
  const [terminalApp, setTerminalApp] = useState<ActiveJobInfo | null>(null);
  const [reviewApp, setReviewApp] = useState<ApplicationEntity | null>(null);

  const deviceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of devices) {
      map[d.id] = d.deviceName;
    }
    return map;
  }, [devices]);

  const fetchUpdates = useCallback(async () => {
    setIsLoading(true);
    try {
      const url =
        selectedDeviceId && selectedDeviceId !== 'ALL'
          ? `/api/v1/updates?deviceId=${selectedDeviceId}`
          : '/api/v1/updates';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setUpdates(data.data.updates);
      }
    } catch (err) {
      console.error('Failed to load outdated software:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Poller for any active jobs to update status in real-time
  useEffect(() => {
    const runningEntries = Object.entries(activeJobs).filter(
      ([_, j]) => j.status === 'RUNNING' || j.status === 'QUEUED' || j.status === 'VERIFYING'
    );
    if (runningEntries.length === 0) return;

    const interval = setInterval(async () => {
      for (const [appId, jobInfo] of runningEntries) {
        try {
          const res = await fetch(`/api/v1/jobs/${jobInfo.jobId}`);
          const data = await res.json();
          if (data.success && data.data?.job) {
            const currentStatus = data.data.job.status;
            setActiveJobs((prev) => ({
              ...prev,
              [appId]: { ...prev[appId], status: currentStatus },
            }));

            if (currentStatus === 'COMPLETED') {
              setActionMessage({
                text: `✔ ${jobInfo.appName} was successfully updated to v${jobInfo.targetVersion}!`,
                type: 'success',
              });
              fetchUpdates();
              if (onUpdated) onUpdated();
            } else if (currentStatus === 'FAILED') {
              setActionMessage({
                text: `✖ Update failed for ${jobInfo.appName}. Click "View Console" for details.`,
                type: 'error',
              });
            }
          }
        } catch (err) {
          console.error('Error polling active job:', err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobs, fetchUpdates, onUpdated]);

  // Quick 1-Click Update for a single application
  const handleQuickUpdate = async (app: ApplicationEntity) => {
    if (!app.availableVersion) return;
    setUpdatingAppId(app.id);
    setActionMessage({
      text: `Starting verified in-app update for ${app.name} to v${app.availableVersion}...`,
      type: 'info',
    });

    try {
      const res = await fetch(`/api/v1/updates/${app.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          acknowledgedTargetVersion: app.availableVersion,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.jobId) {
        const newJobInfo: ActiveJobInfo = {
          jobId: data.data.jobId,
          applicationId: app.id,
          status: 'RUNNING',
          packageId: app.packageId || app.name,
          targetVersion: app.availableVersion,
          appName: app.name,
          deviceName: deviceMap[app.deviceId] || 'This Host',
        };

        setActiveJobs((prev) => ({ ...prev, [app.id]: newJobInfo }));
        setActionMessage({
          text: `Update dispatched for ${app.name}! WinGet is downloading and executing installation in background.`,
          type: 'info',
        });
      } else {
        setActionMessage({
          text: data.error?.message || `Failed to initiate update for ${app.name}.`,
          type: 'error',
        });
      }
    } catch (err: unknown) {
      setActionMessage({
        text: `Error updating ${app.name}: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
    } finally {
      setUpdatingAppId(null);
    }
  };

  // Batch Update Selected or All
  const handleBatchUpdate = async (specificIds?: string[]) => {
    const idsToUpdate = specificIds || (selectedAppIds.size > 0 ? Array.from(selectedAppIds) : undefined);
    const count = idsToUpdate ? idsToUpdate.length : updates.length;

    if (count === 0) return;
    if (
      !confirm(
        `Are you sure you want to update ${count} outdated application${count > 1 ? 's' : ''}? Each package will be verified through WinGet.`
      )
    ) {
      return;
    }

    setBatchUpdating(true);
    setActionMessage({
      text: `Queueing batch update for ${count} packages...`,
      type: 'info',
    });

    try {
      const res = await fetch('/api/v1/updates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: idsToUpdate,
          deviceId: selectedDeviceId !== 'ALL' ? selectedDeviceId : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const jobs = data.data.jobs || [];
        const newJobsMap: Record<string, ActiveJobInfo> = {};
        for (const j of jobs) {
          const matchingApp = updates.find((u) => u.id === j.applicationId);
          newJobsMap[j.applicationId] = {
            jobId: j.id,
            applicationId: j.applicationId,
            status: j.status,
            packageId: j.packageId,
            targetVersion: j.targetVersion,
            appName: matchingApp?.name || j.packageId,
            deviceName: deviceMap[j.deviceId] || 'This Host',
          };
        }
        setActiveJobs((prev) => ({ ...prev, ...newJobsMap }));
        setSelectedAppIds(new Set());
        setActionMessage({
          text: `Batch update authorized! Successfully queued ${data.data.count} package upgrades.`,
          type: 'success',
        });
      } else {
        setActionMessage({
          text: data.error?.message || 'Failed to start batch update.',
          type: 'error',
        });
      }
    } catch (err) {
      setActionMessage({
        text: 'Batch update error: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      });
    } finally {
      setBatchUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedAppIds.size === filteredUpdates.length) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(filteredUpdates.map((u) => u.id)));
    }
  };

  const toggleSelectApp = (id: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedAppIds(next);
  };

  // Filter by search text
  const filteredUpdates = useMemo(() => {
    if (!search.trim()) return updates;
    const q = search.toLowerCase();
    return updates.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.packageId && u.packageId.toLowerCase().includes(q)) ||
        (u.publisher && u.publisher.toLowerCase().includes(q))
    );
  }, [updates, search]);

  return (
    <div className="space-y-4">
      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : actionMessage.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs hover:opacity-75 font-semibold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 bg-card/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <ArrowUpCircle className="h-4 w-4" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Outdated Applications & Software Updates
                </CardTitle>
                <Badge status="UPDATE_AVAILABLE">
                  {updates.length} Pending
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Each outdated software can be updated directly within this application with real-time WinGet output and version verification.
              </CardDescription>
            </div>

            {/* Quick Actions & Batch Update */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUpdates}
                disabled={isLoading}
                className="h-8 px-2.5 text-xs gap-1"
                title="Refresh updates list"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>

              {selectedAppIds.size > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleBatchUpdate()}
                  isLoading={batchUpdating}
                  className="h-8 px-3 text-xs font-bold gap-1.5 shadow-md shadow-brand-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Update Selected ({selectedAppIds.size})</span>
                </Button>
              )}

              {updates.length > 0 && selectedAppIds.size === 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleBatchUpdate()}
                  isLoading={batchUpdating}
                  className="h-8 px-3 text-xs font-bold gap-1.5 shadow-md shadow-brand-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Update All ({updates.length})</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search outdated software by name, package ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-background border border-border/70 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {onDeviceChange && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onDeviceChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-background border border-border/70 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="ALL">All Computers ({devices.length})</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deviceName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-brand-500" />
              <span>Checking for verified upstream software updates...</span>
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-foreground text-sm">
                {search ? 'No Outdated Software Matched Search' : 'All Software Is Up To Date!'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search
                  ? `No applications matching "${search}" currently have pending updates.`
                  : 'All verified applications on the selected host(s) are currently on their latest releases.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {/* Table Header Bar */}
              <div className="px-4 py-2 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-foreground hover:text-brand-500 flex items-center gap-1.5"
                    title="Select / Deselect All"
                  >
                    {selectedAppIds.size === filteredUpdates.length ? (
                      <CheckSquare className="h-4 w-4 text-brand-500" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Select All</span>
                  </button>
                  <span>({filteredUpdates.length} applications)</span>
                </div>
                <span>Actions</span>
              </div>

              {/* Rows */}
              {filteredUpdates.map((app) => {
                const isSelected = selectedAppIds.has(app.id);
                const activeJob = activeJobs[app.id];
                const isUpdatingThis =
                  updatingAppId === app.id ||
                  activeJob?.status === 'RUNNING' ||
                  activeJob?.status === 'VERIFYING' ||
                  activeJob?.status === 'QUEUED';
                const isCompleted = activeJob?.status === 'COMPLETED';
                const isFailed = activeJob?.status === 'FAILED';

                return (
                  <div
                    key={app.id}
                    className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSelected ? 'bg-brand-500/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Checkbox and App Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => toggleSelectApp(app.id)}
                        className="mt-1 text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-brand-500" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate" title={app.name}>
                            {app.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/70 px-2 py-0.5 rounded">
                            <Laptop className="h-3 w-3 text-brand-500" />
                            <span className="truncate max-w-[130px]">{deviceMap[app.deviceId] || 'This Host'}</span>
                          </span>
                          {app.publisher && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                              by {app.publisher}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span className="truncate max-w-[200px]" title={app.packageId || ''}>
                            {app.packageId}
                          </span>
                          <span>•</span>
                          <span>Source: {app.source || 'winget'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Version Diff & Status Indicator */}
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-between md:justify-end">
                      {/* Version Pill */}
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/80 text-xs font-mono shadow-sm">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-sans">Installed</span>
                          <span className="font-medium text-foreground">{app.installedVersion}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] text-brand-600 dark:text-brand-400 block font-sans font-semibold">
                            Target
                          </span>
                          <span className="font-bold text-brand-600 dark:text-brand-400">
                            {app.availableVersion}
                          </span>
                        </div>
                      </div>

                      {/* Execution State / Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isUpdatingThis ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-400">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>{activeJob?.status === 'VERIFYING' ? 'Verifying...' : 'Updating...'}</span>
                            </span>
                            {activeJob && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTerminalApp(activeJob)}
                                className="h-8 px-2.5 text-xs gap-1 font-mono"
                                title="View real-time WinGet console"
                              >
                                <Terminal className="h-3 w-3 text-brand-500" />
                                <span>Console</span>
                              </Button>
                            )}
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Up to Date</span>
                            </span>
                            {activeJob && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTerminalApp(activeJob)}
                                className="h-8 px-2 text-xs text-muted-foreground gap-1"
                              >
                                <Terminal className="h-3 w-3" />
                                <span>Logs</span>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Inspect Details Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReviewApp(app)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                              title="Review checksum and release notes"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Details</span>
                            </Button>

                            {/* Direct 1-Click Update Button */}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleQuickUpdate(app)}
                              className="h-8 px-3 text-xs font-bold gap-1.5 shadow-sm shadow-brand-500/20"
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5" />
                              <span>Update Now</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Terminal Output Modal */}
      <LiveTerminalModal
        isOpen={Boolean(terminalApp)}
        onClose={() => setTerminalApp(null)}
        jobId={terminalApp?.jobId || null}
        appTitle={terminalApp?.appName}
        packageId={terminalApp?.packageId}
        targetVersion={terminalApp?.targetVersion}
        deviceName={terminalApp?.deviceName}
        onCompleted={() => {
          fetchUpdates();
          if (onUpdated) onUpdated();
        }}
      />

      {/* Full Verification & Safety Review Modal */}
      <UpdatePreviewModal
        isOpen={Boolean(reviewApp)}
        application={reviewApp}
        onClose={() => setReviewApp(null)}
        onUpdateCompleted={() => {
          setReviewApp(null);
          fetchUpdates();
          if (onUpdated) onUpdated();
        }}
      />
    </div>
  );
}
