'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { OverviewCharts } from '@/components/features/OverviewCharts';
import { DashboardMetrics } from '@updatepilot/shared';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  Layers,
  ArrowUpCircle,
  CheckCircle2,
  AlertCircle,
  Laptop,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Activity,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/v1/dashboard');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleScanNow = async () => {
    setIsScanning(true);
    try {
      // Find active device to trigger scan
      const devRes = await fetch('/api/v1/devices');
      const devData = await devRes.json();
      if (devData.success && devData.data.devices.length > 0) {
        const deviceId = devData.data.devices[0].id;
        await fetch(`/api/v1/devices/${deviceId}/scans`, { method: 'POST' });
      }
      setTimeout(async () => {
        await fetchDashboardData();
        setIsScanning(false);
      }, 1500);
    } catch {
      setIsScanning(false);
    }
  };

  return (
    <div>
      <Navbar
        onScanClick={handleScanNow}
        onConnectAgentClick={() => setIsConnectModalOpen(true)}
        isScanning={isScanning}
      />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Page Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Overview Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live intelligence and package security for your connected Windows host.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-2"
            >
              <Laptop className="h-4 w-4 text-brand-500" />
              <span>Pair Local Host</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleScanNow}
              isLoading={isScanning}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Run Discovery</span>
            </Button>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Installed
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground">
                {isLoading ? '...' : metrics?.totalApplications ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>Discovered on Windows host</span>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-500/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Updates Available
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowUpCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {isLoading ? '...' : metrics?.updatesAvailable ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Ready for user review</span>
                <Link href="/updates" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  Review &rarr;
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Up to Date
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {isLoading ? '...' : metrics?.upToDate ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Verified with official catalogs
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-border/80 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Unsupported / Other
              </span>
              <div className="h-8 w-8 rounded-lg bg-gray-500/10 text-gray-500 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-foreground">
                {isLoading ? '...' : (metrics?.unsupported ?? 0) + (metrics?.unknown ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Custom or proprietary software
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Host Status & Quick Actions Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-card to-muted/30 border border-border/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">Windows 11 Machine</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last inventory scan:{' '}
                <span className="font-medium text-foreground">
                  {formatRelativeTime(metrics?.lastScanTimestamp)} ({formatDate(metrics?.lastScanTimestamp)})
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link href="/applications" className="w-full md:w-auto">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Layers className="h-3.5 w-3.5" />
                <span>View Inventory</span>
              </Button>
            </Link>
            <Link href="/updates" className="w-full md:w-auto">
              <Button variant="primary" size="sm" className="w-full gap-2">
                <ArrowUpCircle className="h-3.5 w-3.5" />
                <span>Available Updates ({metrics?.updatesAvailable ?? 0})</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Visual Analytics & Distribution Charts */}
        <OverviewCharts metrics={metrics} isLoading={isLoading} />

        {/* Operational Activity Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time log of scans, update operations, and host verifications.
                  </p>
                </div>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">Loading activity...</div>
                ) : !metrics?.recentActivity || metrics.recentActivity.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No recent update operations recorded yet. Run a discovery scan to begin.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {metrics.recentActivity.map((act) => (
                      <div key={act.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            {act.type === 'SCAN' ? <RefreshCw className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4 text-brand-500" />}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-foreground block">{act.title}</span>
                            {act.details && (
                              <span className="text-xs text-muted-foreground block line-clamp-1">{act.details}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge status={act.status} />
                          <span className="text-[11px] text-muted-foreground">{formatRelativeTime(act.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Security & Health Card */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span>Update Safety Rules</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="font-semibold text-foreground block mb-1">Explicit User Approval</span>
                  No software package is ever installed silently or automatically. Every update requires explicit user confirmation.
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="font-semibold text-foreground block mb-1">Cryptographic Signatures</span>
                  WinGet cryptographic hash and publisher signature checks are strictly enforced before running any installer.
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60">
                  <span className="font-semibold text-foreground block mb-1">Post-Update Verification</span>
                  The local agent independently rescans the host to verify the version actually changed before marking success.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={fetchDashboardData}
      />
    </div>
  );
}
