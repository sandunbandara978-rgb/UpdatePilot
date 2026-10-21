'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UpdatePreviewModal } from '@/components/features/UpdatePreviewModal';
import { ApplicationEntity } from '@updatepilot/shared';
import { ArrowUpCircle, ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<ApplicationEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppForUpdate, setSelectedAppForUpdate] = useState<ApplicationEntity | null>(null);

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/updates');
      const data = await res.json();
      if (data.success) {
        setUpdates(data.data.updates);
      }
    } catch (err) {
      console.error('Failed to load updates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  return (
    <div>
      <Navbar />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <span>Update Intelligence Center</span>
            <Badge status="UPDATE_AVAILABLE">
              {updates.length} Available
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review release targets, inspect cryptographic hashes, and approve updates with verified execution.
          </p>
        </div>

        {/* Safety Policy Notice */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Strict Human-in-the-Loop Policy</span>
            <p className="leading-relaxed">
              In accordance with UpdatePilot industrial standards, unattended silent updates are disabled by default. Each software update must be individually reviewed, approved, and cryptographically verified against official repository manifests.
            </p>
          </div>
        </div>

        {/* Updates List */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Inspecting available update packages...
          </div>
        ) : updates.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-foreground text-base">All Supported Applications Up to Date</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No pending package upgrades detected for your verified installed software.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {updates.map((app) => (
              <Card key={app.id} className="hover:border-brand-500/40 transition-all flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-foreground font-bold">{app.name}</CardTitle>
                      <CardDescription className="font-mono text-[11px] mt-0.5">{app.packageId}</CardDescription>
                    </div>
                    <Badge status="UPDATE_AVAILABLE" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Installed</span>
                      <div className="font-mono text-xs font-semibold text-foreground">{app.installedVersion}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-brand-500" />
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-brand-600 dark:text-brand-400">Target</span>
                      <div className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{app.availableVersion}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-muted-foreground">Source: {app.source || 'winget'}</span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedAppForUpdate(app)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                      <span>Review & Update</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <UpdatePreviewModal
        isOpen={Boolean(selectedAppForUpdate)}
        onClose={() => setSelectedAppForUpdate(null)}
        application={selectedAppForUpdate}
        onUpdateCompleted={fetchUpdates}
      />
    </div>
  );
}
