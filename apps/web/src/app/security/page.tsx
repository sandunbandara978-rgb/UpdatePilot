'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { SecurityFindingEntity } from '@updatepilot/shared';
import { ShieldCheck, ExternalLink, Info, Calendar, Database } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SecurityPage() {
  const [findings, setFindings] = useState<SecurityFindingEntity[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/security/findings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFindings(data.data.findings || []);
          setDisclaimer(data.data.disclaimer || '');
          setSource(data.data.source || 'OSV / NVD');
          setLastCheckedAt(data.data.lastCheckedAt || new Date().toISOString());
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <Navbar />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-brand-500" />
            <span>Security Insights</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verified vulnerability and security advisory intelligence mapped to installed software.
          </p>
        </div>

        {/* Data Limitation & Provenance Notice */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-xs text-muted-foreground flex items-start gap-3">
          <Info className="h-5 w-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-semibold text-foreground">Verified Advisory Provenance & Standards</span>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5 text-brand-500" />
                  Source: <strong className="text-foreground">{source}</strong>
                </span>
                {lastCheckedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    Last checked: <strong className="text-foreground">{formatDate(lastCheckedAt)}</strong>
                  </span>
                )}
              </div>
            </div>
            <p className="leading-relaxed">
              {disclaimer ||
                'Security findings are displayed only when supported by verified package identities and trusted vulnerability catalogs (e.g. OSV, NVD, GitHub Advisory Database). No artificial vulnerability scores are ever synthesized.'}
            </p>
          </div>
        </div>

        {/* Findings List */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Checking advisory repositories...
          </div>
        ) : findings.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-foreground text-base">No Open Security Advisories</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No known CVEs currently active for your verified software inventory.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {findings.map((f) => {
              const isDemoFixture = f.id.includes('fixture') || f.id.includes('sec_cve_01');

              return (
                <Card key={f.id} className="border-border/80 hover:border-amber-500/30 transition-all">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground font-mono">{f.cveId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            f.severity === 'CRITICAL' || f.severity === 'HIGH'
                              ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {f.severity}
                        </span>
                        {isDemoFixture && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                            Sample Fixture
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">Package: {f.packageId}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground leading-relaxed">{f.summary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs border-t border-border/50">
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>
                          Affected: <span className="font-mono font-medium text-foreground">{f.affectedVersions}</span>
                        </span>
                        {f.fixedVersion && (
                          <span>
                            Resolved in:{' '}
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {f.fixedVersion}
                            </span>
                          </span>
                        )}
                      </div>
                      {f.advisoryUrl && (
                        <a
                          href={f.advisoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                        >
                          <span>Official Advisory Record</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
