'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { OverviewCharts } from '@/components/features/OverviewCharts';
import { OutdatedSoftwareHub } from '@/components/features/OutdatedSoftwareHub';
import { useDeviceContext } from '@/components/layout/DeviceContext';
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
  Sparkles,
  Server,
  ArrowRight,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const { devices, selectedDeviceId, setSelectedDeviceId, activeDevice, refreshDevices } = useDeviceContext();

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const url =
        selectedDeviceId && selectedDeviceId !== 'ALL'
          ? `/api/v1/dashboard?deviceId=${selectedDeviceId}`
          : '/api/v1/dashboard';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleScanNow = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      // 1. If scanning local host or all computers: run direct local scan
      if (
        selectedDeviceId === 'ALL' ||
        selectedDeviceId.startsWith('dev_local_') ||
        activeDevice?.deviceName.includes('(This PC)')
      ) {
        const res = await fetch('/api/v1/system/scan-local', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setScanMessage(`Discovered ${data.data.appsSaved} applications (${data.data.updatesCount} updates) on ${data.data.deviceName}!`);
        }
      } else if (selectedDeviceId) {
        await fetch(`/api/v1/devices/${selectedDeviceId}/scans`, { method: 'POST' });
        setScanMessage(`Scan job dispatched to ${activeDevice?.deviceName}.`);
      }
      await refreshDevices();
      await fetchDashboardData();
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const hasDemoFixture = devices.some((d) => d.id === 'dev_win11_workstation_fixture');

  return (
    <div>
      <Navbar
        onScanClick={handleScanNow}
        onConnectAgentClick={() => setIsConnectModalOpen(true)}
        isScanning={isScanning}
      />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner if Demo Fixture is currently displayed */}
        {hasDemoFixture && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent border border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Ready to discover real software on your Windows computer?
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Currently showing mock demo data. Click below to inspect your real installed WinGet packages and official release updates.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleScanNow}
              isLoading={isScanning}
              className="gap-2 text-xs flex-shrink-0 shadow-md shadow-brand-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Scan This Computer Now</span>
            </Button>
          </div>
        )}

        {scanMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* Page Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {activeDevice ? activeDevice.deviceName : 'Fleet Overview Dashboard'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeDevice
                ? `Live software intelligence and package security for ${activeDevice.deviceName}.`
                : `Live software intelligence across all ${devices.length} registered Windows hosts in your fleet.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/devices">
              <Button variant="outline" size="sm" className="gap-2">
                <Server className="h-4 w-4 text-brand-500" />
                <span>Manage Fleet ({devices.length})</span>
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={handleScanNow}
              isLoading={isScanning}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{isScanning ? 'Inspecting WinGet...' : 'Run Discovery'}</span>
            </Button>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-brand-500/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Software
              </CardTitle>
              <Layers className="h-4 w-4 text-brand-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-foreground">
                {isLoading ? '—' : metrics?.totalApplications ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Discovered on {activeDevice ? activeDevice.deviceName : 'all fleet hosts'}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-500/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Updates Available
              </CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                {isLoading ? '—' : metrics?.updatesAvailable ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Verified upstream releases pending
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-emerald-500/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Up to Date
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {isLoading ? '—' : metrics?.upToDate ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Matching verified latest versions
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-amber-500/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Hosts
              </CardTitle>
              <Laptop className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                {isLoading ? '—' : metrics?.activeDevicesCount ?? devices.filter((d) => d.status === 'ONLINE').length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Windows machines connected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Outdated Applications & Updates Pending Hub */}
        <OutdatedSoftwareHub
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onDeviceChange={setSelectedDeviceId}
          onUpdated={async () => {
            await refreshDevices();
            await fetchDashboardData();
          }}
        />

        {/* Fleet Computers Quick Overview */}
        {devices.length > 0 && (
          <Card className="p-4 bg-card/60 border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-brand-500" />
                <span className="font-bold text-sm text-foreground">Registered Windows Computers</span>
                <span className="text-xs text-muted-foreground">({devices.length})</span>
              </div>
              <Link href="/devices" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <span>View Full Fleet Management</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 truncate">
                    <span className="font-semibold text-xs text-foreground block truncate" title={dev.deviceName}>
                      {dev.deviceName}
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {dev.osVersion || 'Windows 11'}
                    </span>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      dev.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                    title={dev.status}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

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
                    No recent update operations recorded yet. Click &quot;Run Discovery&quot; above to scan installed software.
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
        onPairedSuccess={async () => {
          await refreshDevices();
          await fetchDashboardData();
        }}
      />
    </div>
  );
}
