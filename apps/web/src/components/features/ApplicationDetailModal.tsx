'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ApplicationEntity, ReleaseMetadataEntity, SecurityFindingEntity } from '@updatepilot/shared';
import { formatDate } from '@/lib/utils';
import { ExternalLink, ShieldCheck, FileText, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string | null;
}

export function ApplicationDetailModal({ isOpen, onClose, applicationId }: ApplicationDetailModalProps) {
  const [data, setData] = useState<{
    application: ApplicationEntity;
    metadata: ReleaseMetadataEntity | null;
    securityFindings: SecurityFindingEntity[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && applicationId) {
      setIsLoading(true);
      fetch(`/api/v1/applications/${applicationId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setData(json.data);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setData(null);
    }
  }, [isOpen, applicationId]);

  if (!isOpen) return null;

  const app = data?.application;
  const meta = data?.metadata;
  const findings = data?.securityFindings || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={app ? app.name : 'Application Profile'}
      description="Manifest metadata, package authenticity, and security advisories."
      maxWidth="lg"
    >
      {isLoading && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Loading package manifest...
        </div>
      )}

      {app && (
        <div className="space-y-5 text-xs">
          {/* Header Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-base">{app.name}</span>
                <Badge status={app.status} />
              </div>
              <p className="font-mono text-muted-foreground mt-1 text-[11px]">{app.packageId || '(No package identity)'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Installed Version</span>
              <div className="font-mono text-sm font-bold text-foreground">{app.installedVersion}</div>
            </div>
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border/60 bg-card">
              <span className="text-muted-foreground font-medium">Publisher:</span>
              <p className="font-semibold text-foreground mt-0.5">{app.publisher || 'Unknown'}</p>
            </div>
            <div className="p-3 rounded-lg border border-border/60 bg-card">
              <span className="text-muted-foreground font-medium">Package Source:</span>
              <p className="font-semibold text-foreground mt-0.5 capitalize">{app.source || 'Local / ARP'}</p>
            </div>
            <div className="p-3 rounded-lg border border-border/60 bg-card">
              <span className="text-muted-foreground font-medium">Available Version:</span>
              <p className="font-semibold text-foreground mt-0.5 font-mono">{app.availableVersion || 'None'}</p>
            </div>
            <div className="p-3 rounded-lg border border-border/60 bg-card">
              <span className="text-muted-foreground font-medium">Last Scanned:</span>
              <p className="font-semibold text-foreground mt-0.5">{formatDate(app.lastScannedAt)}</p>
            </div>
          </div>

          {/* Upstream Metadata */}
          {meta && (
            <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Upstream Release Metadata
              </span>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {meta.license && (
                  <div>
                    <span className="text-muted-foreground">License:</span>{' '}
                    <span className="font-mono text-foreground font-medium">{meta.license}</span>
                  </div>
                )}
                {meta.installerType && (
                  <div>
                    <span className="text-muted-foreground">Installer Type:</span>{' '}
                    <span className="font-mono text-foreground font-medium uppercase">{meta.installerType}</span>
                  </div>
                )}
                {meta.sha256 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">SHA-256:</span>{' '}
                    <span className="font-mono text-[10px] text-foreground break-all">{meta.sha256}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-2">
                {meta.publisherUrl && (
                  <a
                    href={meta.publisherUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    <span>Publisher Homepage</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {meta.releaseNotesUrl && (
                  <a
                    href={meta.releaseNotesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Changelog</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Security Advisories Section */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Security Advisories
            </span>

            {findings.length === 0 ? (
              <div className="p-3 rounded-lg border border-border/60 bg-card text-muted-foreground text-[11px]">
                No verified vulnerability advisories flagged for this package.
              </div>
            ) : (
              findings.map((f) => (
                <div key={f.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-400">{f.cveId}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-foreground">{f.summary}</p>
                  <p className="text-muted-foreground">Affected: {f.affectedVersions} | Fixed in: {f.fixedVersion || 'N/A'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
