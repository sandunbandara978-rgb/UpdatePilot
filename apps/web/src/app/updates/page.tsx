'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { OutdatedSoftwareHub } from '@/components/features/OutdatedSoftwareHub';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { useDeviceContext } from '@/components/layout/DeviceContext';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function UpdatesPage() {
  const { devices, selectedDeviceId, setSelectedDeviceId, refreshDevices } = useDeviceContext();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  return (
    <div>
      <Navbar onConnectAgentClick={() => setIsConnectModalOpen(true)} />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header and Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <span>Update Intelligence Center</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update each out-of-date application individually or in batch directly within this application with real-time WinGet output.
            </p>
          </div>
        </div>

        {/* Safety Policy Notice */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Verified In-App Upgrade Execution</span>
            <p className="leading-relaxed">
              Every package upgrade is executed via verified Windows Package Manager (WinGet) routines with cryptographic signature validation. After installation, the system independently rescans the local inventory to verify the version successfully updated.
            </p>
          </div>
        </div>

        {/* Full Interactive Outdated Software Hub */}
        <OutdatedSoftwareHub
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onDeviceChange={setSelectedDeviceId}
          onUpdated={refreshDevices}
        />
      </div>

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={refreshDevices}
      />
    </div>
  );
}
