'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDeviceContext } from '@/components/layout/DeviceContext';
import { SecurityFindingEntity } from '@updatepilot/shared';
import { ShieldCheck, ExternalLink, Info, Calendar, Database, RefreshCw, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SecurityPage() {
  const { selectedDeviceId } = useDeviceContext();
  const [findings, setFindings] = useState<SecurityFindingEntity[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [feedStatus, setFeedStatus] = useState<string>('');
  const [checkedPackagesCount, setCheckedPackagesCount] = useState<number>(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchFindings = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', 'true');
      if (selectedDeviceId && selectedDeviceId !== 'ALL') params.set('deviceId', selectedDeviceId);

      const res = await fetch(`/api/v1/security/findings?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFindings(data.data.findings || []);
        setDisclaimer(data.data.disclaimer || '');
        setSource(data.data.source || 'NIST National Vulnerability Database (NVD API v2)');
        setFeedStatus(data.data.advisoryFeedStatus || '');
        setCheckedPackagesCount(data.data.checkedPackagesCount ?? 0);
        setLastCheckedAt(data.data.lastCheckedAt || new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed to load security findings:', err);
      setFeedStatus('UNAVAILABLE');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchFindings(false);
  }, [fetchFindings]);

  return (
    <div>
      <Navbar />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-brand-500" />
              <span>Security Insights & Vulnerability Intelligence</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verified CVE intelligence queried against NIST NVD for software with deterministic package identities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFindings(true)}
              disabled={isLoading}
              className="gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Live Advisories</span>
            </Button>

            <Link href="/updates">
              <Button variant="primary" size="sm" className="gap-2 text-xs font-semibold">
                <ArrowUpCircle className="h-4 w-4" />
                <span>Go to Update Center</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Data Limitation & Provenance Notice */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-xs text-muted-foreground flex items-start gap-3">
          <Info className="h-5 w-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Verified Advisory Provenance & Standards</span>
                {feedStatus && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${feedStatus === 'UNAVAILABLE'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                  >
                    {feedStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5 text-brand-500" />
                  Source: <strong className="text-foreground">{source}</strong>
                </span>
                <span>
                  Checked packages: <strong className="text-foreground">{checkedPackagesCount}</strong>
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
                'Security findings are displayed only when supported by verified package identities and trusted vulnerability catalogs. No artificial vulnerability scores are ever synthesized.'}
            </p>
          </div>
        </div>

        {/* Feed Unavailable Honest Notice */}
        {!isLoading && feedStatus === 'UNAVAILABLE' && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>
              Advisory feed temporarily unavailable or rate-limited by NIST NVD. Your software inventory remains intact; click &quot;Refresh Live Advisories&quot; later to retry.
            </span>
          </div>
        )}

        {/* Findings List */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-brand-500" />
            <span>Querying NIST National Vulnerability Database...</span>
          </div>
        ) : findings.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-foreground text-base">No Active Verified CVEs Flagged</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {checkedPackagesCount === 0
                ? 'Run a host software discovery scan first so verified package IDs can be checked against NIST NVD.'
                : `Checked ${checkedPackagesCount} verified package${checkedPackagesCount === 1 ? '' : 's'} against NVD with no open CVE findings matching the installed versions.`}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {findings.map((f) => (
              <Card key={f.id} className="border-border/80 hover:border-amber-500/30 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground font-mono">{f.cveId}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${f.severity === 'CRITICAL' || f.severity === 'HIGH'
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}
                      >
                        {f.severity}
                      </span>
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
                          Available Update:{' '}
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {f.fixedVersion}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Link href="/updates">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-brand-500" />
                          <span>Patch in Update Center</span>
                        </Button>
                      </Link>

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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
