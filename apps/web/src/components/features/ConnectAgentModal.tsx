'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Laptop,
  Network,
  Download,
  Sparkles,
  RefreshCw,
  Server,
} from 'lucide-react';

interface ConnectAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairedSuccess?: () => void;
}

export function ConnectAgentModal({ isOpen, onClose, onPairedSuccess }: ConnectAgentModalProps) {
  const [activeTab, setActiveTab] = useState<'network' | 'direct'>('direct');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localScanLoading, setLocalScanLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      // If localhost, let user know LAN IP can be used
      setServerUrl(origin);
    }
  }, []);

  const generateCode = async () => {
    setIsLoading(true);
    setIsSuccess(false);
    try {
      const res = await fetch('/api/v1/devices/generate-code', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPairingCode(data.data.pairingCode);
        setExpiresAt(data.data.expiresAt);
        pollForPairing();
      }
    } catch (err) {
      console.error('Failed to generate code:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const pollForPairing = () => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 50) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch('/api/v1/devices');
        const data = await res.json();
        if (data.success && data.data.devices.length > 0) {
          // Check if any non-pending device is online
          const realOnline = data.data.devices.find(
            (d: { status: string; deviceName: string }) =>
              d.status === 'ONLINE' && !d.deviceName.includes('Pending Pairing') && !d.deviceName.includes('(Dev Fixture)')
          );
          if (realOnline) {
            setIsSuccess(true);
            setSuccessMessage(`Connected ${realOnline.deviceName} successfully!`);
            clearInterval(interval);
            if (onPairedSuccess) onPairedSuccess();
          }
        }
      } catch {
        // continue polling
      }
    }, 3000);
  };

  const handleDirectLocalScan = async () => {
    setLocalScanLoading(true);
    try {
      const res = await fetch('/api/v1/system/scan-local', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        setSuccessMessage(
          `Discovered ${data.data.appsSaved} applications (${data.data.updatesCount} updates available) on ${data.data.deviceName}!`
        );
        if (onPairedSuccess) onPairedSuccess();
      } else {
        alert(data.error?.message || 'Local scan failed. Ensure WinGet is installed.');
      }
    } catch (err) {
      alert('Error running direct local scan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLocalScanLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const networkCommand = `Invoke-WebRequest -Uri "${serverUrl}/api/v1/agent/install" -OutFile "$env:TEMP\\UpdatePilot.ps1"; & "$env:TEMP\\UpdatePilot.ps1" -Pair ${pairingCode || 'UP-XXXXXX'} -Server "${serverUrl}"`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Windows Computers"
      description="Discover real software inventory on this host or connect other computers across your fleet."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {!isSuccess && (
          <div className="flex border-b border-border/80 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-all ${
                activeTab === 'direct'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Laptop className="h-4 w-4" />
              <span>This Computer (Instant Scan)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('network');
                if (!pairingCode) generateCode();
              }}
              className={`flex items-center gap-2 pb-3 px-3 border-b-2 transition-all ${
                activeTab === 'network'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="h-4 w-4" />
              <span>Connect Any Computer (Fleet)</span>
            </button>
          </div>
        )}

        {/* TAB 1: DIRECT LOCAL SCAN */}
        {activeTab === 'direct' && !isSuccess && (
          <div className="space-y-5 py-2">
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-brand-500" />
                <span>One-Click Real Output Discovery</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                UpdatePilot will directly inspect your local Windows machine via Windows Package Manager (WinGet), discover all installed software, compare version manifests against official catalogs, and replace any fixture data with your real computer inventory.
              </p>
            </div>

            <div className="text-center py-4 space-y-4">
              <Button
                variant="primary"
                size="lg"
                onClick={handleDirectLocalScan}
                isLoading={localScanLoading}
                className="gap-2 px-6 shadow-lg shadow-brand-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Run WinGet Discovery on This Host</span>
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Requires Windows 10/11 with WinGet. No installation needed.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: NETWORK / FLEET AGENT PAIRING */}
        {activeTab === 'network' && !isSuccess && (
          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-brand-500" />
                <span>UpdatePilot Server URL for Remote Machines</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Ensure remote computers can reach this IP address over your local network or VPN.
              </p>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://192.168.1.50:3000"
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {pairingCode && (
              <div className="space-y-4">
                {/* Pairing Code Banner */}
                <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Fleet Pairing Code
                  </span>
                  <div className="text-3xl font-extrabold tracking-widest text-brand-600 dark:text-brand-400 my-1 font-mono">
                    {pairingCode}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Valid for 10 minutes</span>
                  </div>
                </div>

                {/* Terminal Instructions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      On any remote Windows PC, open PowerShell and run:
                    </span>
                    <button
                      onClick={() => copyToClipboard(networkCommand)}
                      className="flex items-center gap-1 text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed select-all">
                    <code>{networkCommand}</code>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Listening for remote computer handshake...</span>
                  </div>
                  <a
                    href={`${serverUrl}/api/v1/agent/install`}
                    download="UpdatePilot-Client.ps1"
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Script File</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUCCESS STATE */}
        {isSuccess && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">Host Connected with Real Data!</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {successMessage || 'Software inventory and live update manifests have been synchronized.'}
              </p>
            </div>
            <Button onClick={onClose} variant="primary">
              View Discovered Applications
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
