'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LiveTerminalModal } from '@/components/features/LiveTerminalModal';
import { UpdatePreviewModal } from '@/components/features/UpdatePreviewModal';
import { BatchUpdateProgressModal } from '@/components/features/BatchUpdateProgressModal';
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
  Percent,
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

  // Active update tracking & live percentages
  const [activeJobs, setActiveJobs] = useState<Record<string, ActiveJobInfo>>({}); // keyed by applicationId
  const [jobPercentages, setJobPercentages] = useState<Record<string, number>>({});
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modals state
  const [batchModalApps, setBatchModalApps] = useState<ApplicationEntity[] | null>(null);
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

  // Poller for any active background jobs to update status and percentage
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

            // Calculate progressive percentage
            setJobPercentages((prev) => {
              const current = prev[appId] || 25;
              if (currentStatus === 'COMPLETED') return { ...prev, [appId]: 100 };
              if (currentStatus === 'VERIFYING') return { ...prev, [appId]: 92 };
              if (currentStatus === 'RUNNING') return { ...prev, [appId]: Math.min(88, current + 10) };
              return prev;
            });

            if (currentStatus === 'COMPLETED') {
              setActionMessage({
                text: `âœ” ${jobInfo.appName} was successfully updated to v${jobInfo.targetVersion}! (100% Verified)`,
                type: 'success',
              });
              fetchUpdates();
              if (onUpdated) onUpdated();
            } else if (currentStatus === 'FAILED') {
              setActionMessage({
                text: `âœ– Update failed for ${jobInfo.appName}. Click "View Console" for details.`,
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

  // Start percentage update modal for a single application
  const handleQuickUpdate = (app: ApplicationEntity) => {
    if (!app.availableVersion) return;
    setBatchModalApps([app]);
  };

  // Start percentage update modal for all or selected applications
  const handleStartBatchUpdate = (specificApps?: ApplicationEntity[]) => {
    const targetApps =
      specificApps ||
      (selectedAppIds.size > 0
        ? updates.filter((u) => selectedAppIds.has(u.id))
        : updates);

    if (targetApps.length === 0) return;
    setBatchModalApps(targetApps);
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
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 transition-all ${
            actionMessage.type === 'success'
              ? 'bg-[#34c759]/10 border-[#34c759]/20 text-[#28a745] dark:text-[#34c759]'
              : actionMessage.type === 'error'
              ? 'bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#d32f2f] dark:text-[#ff453a]'
              : 'bg-[#0071e3]/10 border-[#0071e3]/20 text-[#0071e3] dark:text-[#2997ff]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-[#34c759] flex-shrink-0" />
            ) : actionMessage.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-[#ff3b30] flex-shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 text-[#0071e3] animate-spin flex-shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs hover:opacity-75 font-semibold px-2 py-0.5"
          >
            âœ•
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <Card className="border-black/[0.06] dark:border-white/[0.08] shadow-apple overflow-hidden">
        <CardHeader className="pb-3 border-b border-black/[0.04] dark:border-white/[0.06] bg-white/50 dark:bg-black/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <ArrowUpCircle className="h-4 w-4" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Outdated Applications & Software Updates
                </CardTitle>
                <Badge status="UPDATE_AVAILABLE">
                  {updates.length} Outdated
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Update each outdated software individually or sequentially with real-time percentage tracking.
              </CardDescription>
            </div>

            {/* Quick Actions & Percentage Batch Update */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUpdates}
                disabled={isLoading}
                className="h-8 px-3 text-xs gap-1.5 rounded-full"
                title="Refresh updates list"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>

              {/* Update Selected with Percentage */}
              {selectedAppIds.size > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleStartBatchUpdate()}
                  className="h-8 px-3.5 text-xs font-semibold gap-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm"
                >
                  <Percent className="h-3.5 w-3.5" />
                  <span>Update Selected ({selectedAppIds.size}) with %</span>
                </Button>
              )}

              {/* Update Each with Percentage (Master Action) */}
              {updates.length > 0 && selectedAppIds.size === 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleStartBatchUpdate(updates)}
                  className="h-8 px-4 text-xs font-semibold gap-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm hover:shadow active:scale-95 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Update Each ({updates.length}) with Live %</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search outdated software by name, package ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-black/[0.04] dark:border-white/[0.08] text-xs text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
              />
            </div>

            {onDeviceChange && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Laptop className="h-3.5 w-3.5 text-neutral-400" />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onDeviceChange(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 border border-black/[0.04] dark:border-white/[0.08] text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[#0071e3] cursor-pointer"
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
              <RefreshCw className="h-5 w-5 animate-spin text-[#0071e3]" />
              <span>Checking for verified upstream software updates...</span>
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
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
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {/* Table Header Bar */}
              <div className="px-4 py-2 bg-neutral-50/70 dark:bg-neutral-900/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-foreground hover:text-[#0071e3] flex items-center gap-1.5"
                    title="Select / Deselect All"
                  >
                    {selectedAppIds.size === filteredUpdates.length ? (
                      <CheckSquare className="h-4 w-4 text-[#0071e3]" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Select All</span>
                  </button>
                  <span>({filteredUpdates.length} outdated packages)</span>
                </div>
                <span>Actions & Live Progress</span>
              </div>

              {/* Rows */}
              {filteredUpdates.map((app) => {
                const isSelected = selectedAppIds.has(app.id);
                const activeJob = activeJobs[app.id];
                const currentPercent = jobPercentages[app.id] || 35;
                const isUpdatingThis =
                  updatingAppId === app.id ||
                  activeJob?.status === 'RUNNING' ||
                  activeJob?.status === 'VERIFYING' ||
                  activeJob?.status === 'QUEUED';
                const isCompleted = activeJob?.status === 'COMPLETED';

                return (
                  <div
                    key={app.id}
                    className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSelected ? 'bg-[#0071e3]/[0.03]' : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-900/30'
                    }`}
                  >
                    {/* Checkbox and App Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => toggleSelectApp(app.id)}
                        className="mt-1 text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#0071e3]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate" title={app.name}>
                            {app.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                            <Laptop className="h-3 w-3 text-[#0071e3]" />
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
                          <span>â€¢</span>
                          <span>Source: {app.source || 'winget'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Version Diff & Status Indicator */}
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-between md:justify-end">
                      {/* Version Pill */}
                      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.05] dark:border-white/[0.08] text-xs font-mono shadow-sm">
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans">Installed</span>
                          <span className="font-medium text-foreground">{app.installedVersion}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-[#0071e3] flex-shrink-0" />
                        <div>
                          <span className="text-[9px] text-[#0071e3] block font-sans font-semibold">
                            Target
                          </span>
                          <span className="font-bold text-[#0071e3]">
                            {app.availableVersion}
                          </span>
                        </div>
                      </div>

                      {/* Execution State / Action Buttons with Live Percentage */}
                      <div className="flex items-center gap-2">
                        {isUpdatingThis ? (
                          /* In-Row Live Percentage Bar */
                          <div className="flex flex-col gap-1 min-w-[150px] p-2 rounded-xl bg-[#0071e3]/[0.06] border border-[#0071e3]/20">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[#0071e3] flex items-center gap-1.5 text-[11px]">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>{activeJob?.status === 'VERIFYING' ? 'Verifying' : 'Updating'}</span>
                              </span>
                              <span className="font-mono font-bold text-[#0071e3] text-xs">
                                {currentPercent}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-[#0071e3]/15 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#0071e3] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                                style={{ width: `${currentPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 text-xs font-bold text-[#34c759] font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>100% Verified</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Inspect Details Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReviewApp(app)}
                              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-full"
                              title="Review checksum and release notes"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Details</span>
                            </Button>

                            {/* Direct 1-Click Update Button with Live % Modal */}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleQuickUpdate(app)}
                              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm active:scale-95 transition-all"
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5" />
                              <span>Update with %</span>
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

      {/* Sequential Batch / Individual Progress Modal with Live Percentages */}
      <BatchUpdateProgressModal
        isOpen={Boolean(batchModalApps)}
        onClose={() => setBatchModalApps(null)}
        appsToUpdate={batchModalApps || []}
        deviceName={selectedDeviceId !== 'ALL' ? (deviceMap[selectedDeviceId] || 'This Host') : 'This PC'}
        onAllCompleted={() => {
          fetchUpdates();
          if (onUpdated) onUpdated();
        }}
      />

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
