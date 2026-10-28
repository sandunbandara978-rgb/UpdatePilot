'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { DeviceEntity } from '@updatepilot/shared';
import { formatDate } from '@/lib/utils';
import { Settings, Laptop, KeyRound, Trash2, Moon, Sun, Shield, Check, Info } from 'lucide-react';

export default function SettingsPage() {
  const [devices, setDevices] = useState<DeviceEntity[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Preference switches with local persistence
  const [autoCheck, setAutoCheck] = useState(true);
  const [scanInterval, setScanInterval] = useState('24');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isClearingDemo, setIsClearingDemo] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/v1/devices');
      const data = await res.json();
      if (data.success) {
        setDevices(data.data.devices);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  useEffect(() => {
    fetchDevices();

    // Load persisted theme
    const savedTheme = localStorage.getItem('updatepilot_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }

    // Load persisted scan preferences
    const savedAutoCheck = localStorage.getItem('updatepilot_auto_check');
    if (savedAutoCheck !== null) {
      setAutoCheck(savedAutoCheck === 'true');
    }

    const savedInterval = localStorage.getItem('updatepilot_scan_interval');
    if (savedInterval) {
      setScanInterval(savedInterval);
    }
  }, []);

  const handleRevoke = async (deviceId: string) => {
    if (confirm('Are you sure you want to revoke this agent? The device will no longer be able to poll or receive update jobs.')) {
      try {
        await fetch(`/api/v1/devices/${deviceId}`, { method: 'DELETE' });
        await fetchDevices();
      } catch (err) {
        console.error('Failed to revoke device:', err);
      }
    }
  };

  const setThemeMode = (mode: 'dark' | 'light') => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('updatepilot_theme', 'dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('updatepilot_theme', 'light');
      setIsDark(false);
    }
    showSavedNotification('Theme preference saved');
  };

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheck(checked);
    localStorage.setItem('updatepilot_auto_check', String(checked));
    showSavedNotification('Discovery preferences updated');
  };

  const handleScanIntervalChange = (val: string) => {
    setScanInterval(val);
    localStorage.setItem('updatepilot_scan_interval', val);
    showSavedNotification('Scan interval saved');
  };

  const showSavedNotification = (msg: string) => {
    setSaveSuccessMessage(msg);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleClearDemoFixtures = async () => {
    if (confirm('Remove sample mock applications? Real scans from your Windows host will be strictly preserved.')) {
      setIsClearingDemo(true);
      try {
        const res = await fetch('/api/v1/system/clear-demo', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showSavedNotification(`Cleaned ${data.data.clearedCount} sample fixtures. Database now contains only real scans.`);
          await fetchDevices();
        }
      } catch (err) {
        console.error('Failed to clear demo data:', err);
      } finally {
        setIsClearingDemo(false);
      }
    }
  };

  return (
    <div>
      <Navbar onConnectAgentClick={() => setIsConnectModalOpen(true)} />

      <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Settings className="h-7 w-7 text-brand-500" />
              <span>Platform Settings & Agent Management</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage connected Windows hosts, security preferences, and dashboard appearances.
            </p>
          </div>

          {saveSuccessMessage && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-fade-in">
              <Check className="h-4 w-4" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Connected Windows Hosts */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Laptop className="h-4 w-4 text-brand-500" />
                <span>Connected Windows Hosts</span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Devices authorized to synchronize inventory and perform verified updates via WinGet.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <KeyRound className="h-3.5 w-3.5 text-brand-500" />
              <span>Pair New Host</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {devices.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No Windows devices paired yet. Click &quot;Pair New Host&quot; to connect your local machine.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {devices.map((dev) => (
                  <div key={dev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{dev.deviceName}</span>
                        <Badge status={dev.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dev.osVersion} &bull; Agent v{dev.agentVersion} &bull; Last seen: {formatDate(dev.lastSeenAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {dev.status !== 'REVOKED' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(dev.id)}
                          className="h-8 px-3 text-xs gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Revoke Access</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base font-bold">Theme & Appearance</CardTitle>
            <CardDescription className="text-xs">
              Choose your preferred interface theme. Designed for WCAG 2.2 AA compliant contrast.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 w-36 transition-all ${
                  isDark
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                <Moon className="h-5 w-5" />
                <span className="text-xs">Dark Industrial</span>
              </button>

              <button
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 w-36 transition-all ${
                  !isDark
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                <Sun className="h-5 w-5" />
                <span className="text-xs">Light Studio</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Scan & Update Preferences */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base font-bold">Scan & Discovery Preferences</CardTitle>
            <CardDescription className="text-xs">
              Configure background polling intervals and update detection thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-card cursor-pointer">
              <div>
                <span className="font-semibold text-foreground block">Automatic Discovery Check</span>
                <span className="text-muted-foreground text-[11px]">
                  Instruct the agent to inspect WinGet package catalogs on scheduled intervals.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoCheck}
                onChange={(e) => handleAutoCheckChange(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </label>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div>
                <span className="font-semibold text-foreground block">Periodic Scan Interval</span>
                <span className="text-muted-foreground text-[11px]">
                  Hours between background inventory refresh cycles.
                </span>
              </div>
              <select
                value={scanInterval}
                onChange={(e) => handleScanIntervalChange(e.target.value)}
                className="py-1.5 px-3 rounded-md bg-background border border-border text-foreground font-medium text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="6">Every 6 Hours</option>
                <option value="12">Every 12 Hours</option>
                <option value="24">Every 24 Hours</option>
                <option value="48">Every 48 Hours</option>
              </select>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground text-[11px]">
              <Info className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
              <span>
                <strong>Operational Note:</strong> Continuous scanning and polling for update jobs are executed securely by your running Windows Agent service (polling every 15s). Scheduled automated background runs (FR-13) can also be scheduled via Windows Task Scheduler.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Demo Fixture Data Isolation */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-500" />
              <span>Demo Fixtures & Data Hygiene</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Clear pre-seeded demo mock data to ensure that only real, verified software scans appear in your production database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              If your database contains seeded mock software from initial development, click below to purge all demo entries. Your real machine scans and update jobs will remain untouched.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDemoFixtures}
              isLoading={isClearingDemo}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              <span>Purge Demo Fixtures</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={fetchDevices}
      />
    </div>
  );
}
