'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { useDeviceContext } from '@/components/layout/DeviceContext';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  Laptop,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowUpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function FleetDevicesPage() {
  const { devices, refreshDevices, setSelectedDeviceId } = useDeviceContext();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [scanningDeviceId, setScanningDeviceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleScanDevice = async (device: { id: string; deviceName: string }) => {
    setScanningDeviceId(device.id);
    setStatusMessage(null);
    try {
      if (device.id.startsWith('dev_local_') || device.deviceName.includes('(This PC)')) {
        const res = await fetch('/api/v1/system/scan-local', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setStatusMessage(`Scan completed on ${device.deviceName}: discovered ${data.data.appsSaved} applications.`);
          await refreshDevices();
        } else {
          alert(data.error?.message || 'Scan failed.');
        }
      } else {
        const res = await fetch(`/api/v1/devices/${device.id}/scans`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setStatusMessage(`Scan job queued for ${device.deviceName}. Waiting for agent polling...`);
        } else {
          alert('Failed to trigger scan job.');
        }
      }
    } catch (err) {
      alert('Error triggering scan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setScanningDeviceId(null);
    }
  };

  const handleRemoveDevice = async (deviceId: string, deviceName: string) => {
    if (confirm(`Are you sure you want to remove "${deviceName}" from your fleet?`)) {
      try {
        await fetch(`/api/v1/devices/${deviceId}`, { method: 'DELETE' });
        await refreshDevices();
      } catch (err) {
        console.error('Failed to remove device:', err);
      }
    }
  };

  const handleClearDemo = async () => {
    try {
      await fetch('/api/v1/system/clear-demo', { method: 'POST' });
      await refreshDevices();
    } catch (err) {
      console.error('Failed to clear demo:', err);
    }
  };

  const hasDemoFixture = devices.some((d) => d.id === 'dev_win11_workstation_fixture');

  return (
    <div>
      <Navbar onConnectAgentClick={() => setIsConnectModalOpen(true)} />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Laptop className="h-7 w-7 text-brand-500" />
              <span>Fleet Computers & Host Management</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor, discover, and trigger remote scans across all connected Windows machines in your organization.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasDemoFixture && (
              <Button variant="outline" size="sm" onClick={handleClearDemo} className="text-xs">
                Clear Sample Demo Host
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Connect New Computer</span>
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Devices Grid */}
        {devices.length === 0 ? (
          <Card className="p-12 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">No Computers Connected Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Connect your local machine or any Windows computer across your local network to discover real software inventory.
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsConnectModalOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Discover This Host Now</span>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {devices.map((device) => {
              const isOnline = device.status === 'ONLINE';
              const isLocal =
                device.id.startsWith('dev_local_') || device.deviceName.includes('(This PC)');

              return (
                <Card
                  key={device.id}
                  className="hover:border-brand-500/40 transition-all flex flex-col justify-between overflow-hidden"
                >
                  <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-foreground truncate max-w-[200px]" title={device.deviceName}>
                            {device.deviceName}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs font-mono">
                          {device.osVersion || 'Windows 11'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-card/60 border border-border/60">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Agent Type
                        </span>
                        <span className="font-semibold text-foreground text-[11px]">
                          {isLocal ? 'Embedded Engine' : device.agentVersion || 'Remote Client'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-card/60 border border-border/60">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Last Seen
                        </span>
                        <span className="font-semibold text-foreground text-[11px]">
                          {formatRelativeTime(device.lastSeenAt)}
                        </span>
                      </div>
                    </div>

                    {/* Quick navigation and actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                      <Link
                        href={`/applications`}
                        onClick={() => setSelectedDeviceId(device.id)}
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 h-8">
                          <Layers className="h-3.5 w-3.5" />
                          <span>Apps</span>
                        </Button>
                      </Link>

                      <Link
                        href={`/updates`}
                        onClick={() => setSelectedDeviceId(device.id)}
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 h-8">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-brand-500" />
                          <span>Updates</span>
                        </Button>
                      </Link>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleScanDevice(device)}
                        isLoading={scanningDeviceId === device.id}
                        className="h-8 px-2.5 text-xs gap-1"
                        title="Scan software on this machine"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Scan</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDevice(device.id, device.deviceName)}
                        className="h-8 px-2 text-muted-foreground hover:text-red-500"
                        title="Remove device"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={async () => {
          await refreshDevices();
          setIsConnectModalOpen(false);
        }}
      />
    </div>
  );
}
