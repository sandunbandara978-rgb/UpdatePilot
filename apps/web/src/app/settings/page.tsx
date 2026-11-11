'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Settings, Laptop, Trash2, KeyRound, Check, Moon, Sun, Info, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface DeviceItem {
  id: string;
  deviceName: string;
  osVersion: string;
  agentVersion: string;
  status: 'ONLINE' | 'OFFLINE' | 'REVOKED';
  lastSeenAt: string;
}

export default function SettingsPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);
  const [scanInterval, setScanInterval] = useState('12');
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.data?.settings) {
        const s = data.data.settings;
        setAutoCheck(Boolean(s.autoCheckUpdates));
        setScanInterval(String(s.scanIntervalHours ?? 12));
        setEmailAlerts(Boolean(s.emailAlerts));

        const themeValue = s.theme === 'dark' ? 'dark' : s.theme === 'light' ? 'light' : localStorage.getItem('updatepilot_theme') || 'light';
        const darkActive = themeValue === 'dark';
        setIsDark(darkActive);
        if (darkActive) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('updatepilot_theme', darkActive ? 'dark' : 'light');
        localStorage.setItem('updatepilot_auto_check', String(Boolean(s.autoCheckUpdates)));
        localStorage.setItem('updatepilot_scan_interval', String(s.scanIntervalHours ?? 12));
        return;
      }
    } catch {
      // fallback to localStorage if API unreachable
    }

    const storedTheme = localStorage.getItem('updatepilot_theme');
    const isDarkTheme = storedTheme === 'dark';
    setIsDark(isDarkTheme);
    const storedAutoCheck = localStorage.getItem('updatepilot_auto_check');
    if (storedAutoCheck !== null) setAutoCheck(storedAutoCheck === 'true');
    const storedInterval = localStorage.getItem('updatepilot_scan_interval');
    if (storedInterval) setScanInterval(storedInterval);
  };

  const persistSettingsToServer = async (
    patch: {
      theme?: 'light' | 'dark' | 'system';
      autoCheckUpdates?: boolean;
      scanIntervalHours?: number;
      emailAlerts?: boolean;
    },
    notifyText: string
  ) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveError(data.error?.message || 'Failed to save preferences to database.');
        return;
      }
      showSavedNotification(notifyText);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/v1/devices');
      const data = await res.json();
      if (data.success && data.data) {
        const list = Array.isArray(data.data) ? data.data : data.data.devices || [];
        setDevices(list);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (
      confirm(
        'Are you sure you want to revoke this agent? The device will no longer be able to poll or receive update jobs.'
      )
    ) {
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
    persistSettingsToServer({ theme: mode }, 'Theme preference saved to account');
  };

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheck(checked);
    localStorage.setItem('updatepilot_auto_check', String(checked));
    persistSettingsToServer({ autoCheckUpdates: checked }, 'Discovery preferences saved');
  };

  const handleScanIntervalChange = (val: string) => {
    setScanInterval(val);
    localStorage.setItem('updatepilot_scan_interval', val);
    persistSettingsToServer({ scanIntervalHours: parseInt(val, 10) || 12 }, 'Scan interval saved');
  };

  const handleEmailAlertsChange = (checked: boolean) => {
    setEmailAlerts(checked);
    persistSettingsToServer({ emailAlerts: checked }, 'Notification preferences saved');
  };

  const showSavedNotification = (msg: string) => {
    setSaveSuccessMessage(msg);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
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
              Manage connected Windows hosts, persisted account preferences, and dashboard appearance.
            </p>
          </div>

          {saveSuccessMessage && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-fade-in">
              <Check className="h-4 w-4" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}

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
                  <div
                    key={dev.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
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
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 w-36 transition-all ${isDark
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
              >
                <Moon className="h-6 w-6" />
                <span className="text-xs">Dark Mode</span>
              </button>

              <button
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 w-36 transition-all ${!isDark
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
              >
                <Sun className="h-6 w-6" />
                <span className="text-xs">Light Mode</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Agent Discovery & Scan Cadence Preferences */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-500" />
                <span>Agent Discovery & Scan Cadence Preferences</span>
              </CardTitle>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Database Persisted
              </span>
            </div>
            <CardDescription className="text-xs">
              Configure periodic inventory discovery, update alerts, and persisted account settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-card cursor-pointer">
              <div>
                <span className="font-semibold text-foreground block">Automatic Discovery Check</span>
                <span className="text-muted-foreground text-[11px]">
                  Instruct the dashboard and agent to inspect WinGet package catalogs on scheduled intervals.
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
                  Target cadence between background inventory refresh cycles.
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

            <label className="flex items-center justify-between p-3 rounded-lg border border-border bg-card cursor-pointer">
              <div>
                <span className="font-semibold text-foreground block">Critical Advisory Alert Flag</span>
                <span className="text-muted-foreground text-[11px]">
                  Store preference for highlighting high-severity update notifications on your account.
                </span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => handleEmailAlertsChange(e.target.checked)}
                className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </label>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground text-[11px]">
              <Info className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
              <span>
                <strong>Architecture Note:</strong> Settings are persisted per account in the backend database (`UserSetting`). Continuous job polling and WinGet execution are performed autonomously by the paired Windows Desktop Agent service.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                isLoading={isSaving}
                onClick={() => {
                  localStorage.setItem('updatepilot_auto_check', String(autoCheck));
                  localStorage.setItem('updatepilot_scan_interval', scanInterval);
                  localStorage.setItem('updatepilot_theme', isDark ? 'dark' : 'light');
                  persistSettingsToServer(
                    {
                      theme: isDark ? 'dark' : 'light',
                      autoCheckUpdates: autoCheck,
                      scanIntervalHours: parseInt(scanInterval, 10) || 12,
                      emailAlerts,
                    },
                    'All platform preferences persisted successfully.'
                  );
                }}
                className="gap-2 text-xs"
              >
                <Check className="h-4 w-4" />
                <span>Save All Preferences</span>
              </Button>
            </div>
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
