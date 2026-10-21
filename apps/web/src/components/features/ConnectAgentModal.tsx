'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Terminal, Copy, Check, ShieldCheck, Clock } from 'lucide-react';

interface ConnectAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairedSuccess?: () => void;
}

export function ConnectAgentModal({ isOpen, onClose, onPairedSuccess }: ConnectAgentModalProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
      if (attempts > 40) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch('/api/v1/devices');
        const data = await res.json();
        if (data.success) {
          const hasOnline = data.data.devices.some((d: { status: string }) => d.status === 'ONLINE');
          if (hasOnline) {
            setIsSuccess(true);
            clearInterval(interval);
            if (onPairedSuccess) onPairedSuccess();
          }
        }
      } catch {
        // continue polling
      }
    }, 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Windows Agent"
      description="Pair your local Windows machine with UpdatePilot using a secure one-time code."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {!pairingCode && !isSuccess && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Terminal className="h-6 w-6" />
            </div>
            <div className="max-w-sm mx-auto">
              <h4 className="text-base font-semibold text-foreground">Generate One-Time Pairing Code</h4>
              <p className="text-xs text-muted-foreground mt-1">
                The code is cryptographically salted and valid for 10 minutes. Plaintext credentials are never saved in the cloud.
              </p>
            </div>
            <Button onClick={generateCode} isLoading={isLoading} className="gap-2">
              Generate Pairing Code
            </Button>
          </div>
        )}

        {pairingCode && !isSuccess && (
          <div className="space-y-5">
            {/* Pairing Code Banner */}
            <div className="p-6 rounded-2xl bg-brand-500/5 border border-brand-500/20 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Single-Use Pairing Code
              </span>
              <div className="text-4xl font-extrabold tracking-widest text-brand-600 dark:text-brand-400 my-2 font-mono">
                {pairingCode}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Expires in 10 minutes</span>
              </div>
            </div>

            {/* Terminal Instructions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>In your terminal, execute:</span>
                <button
                  onClick={() => copyToClipboard(`.\\UpdatePilot-Agent.ps1 pair -Code ${pairingCode}`)}
                  className="flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
                <code>.\UpdatePilot-Agent.ps1 pair -Code {pairingCode}</code>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Waiting for agent handshake...</span>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">Device Successfully Paired!</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Your Windows machine is now connected. Software inventory and updates will synchronize automatically.
              </p>
            </div>
            <Button onClick={onClose} variant="primary">
              Return to Dashboard
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
