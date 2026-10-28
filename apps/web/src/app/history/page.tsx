'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UpdateJobEntity } from '@updatepilot/shared';
import { formatDate } from '@/lib/utils';
import { History, Download, Terminal, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<UpdateJobEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/history?page=${page}&limit=15`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.data.items);
        setTotal(data.data.total);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  return (
    <div>
      <Navbar />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header & Export Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <History className="h-7 w-7 text-brand-500" />
              <span>Update History & Audit Trail</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historical ledger of software updates, post-install verification checks, and diagnostic logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a href="/api/v1/history/export?type=updates" download="updatepilot-update-history.csv">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span>Export Update History (CSV)</span>
              </Button>
            </a>
          </div>
        </div>

        {/* History Table */}
        <Card className="overflow-hidden border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Package Identity</th>
                  <th className="py-3.5 px-4">Version Transition</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Exit Code</th>
                  <th className="py-3.5 px-4 text-right">Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      Loading audit records...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No update jobs have been executed yet. Updates confirmed in the Update Center will appear here.
                    </td>
                  </tr>
                ) : (
                  history.map((job) => (
                    <React.Fragment key={job.id}>
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(job.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                          {job.packageId}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-muted-foreground">{job.currentVersion}</span>
                          <span className="mx-1 text-brand-500 font-bold">&rarr;</span>
                          <span className="text-foreground font-bold">{job.targetVersion}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={job.status} />
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {job.exitCode !== null && job.exitCode !== undefined ? (
                            <span className={job.exitCode === 0 ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>
                              {job.exitCode}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">â€”</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedLogId((prev) => (prev === job.id ? null : job.id))
                            }
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <Terminal className="h-3 w-3" />
                            <span>{expandedLogId === job.id ? 'Hide Logs' : 'View Logs'}</span>
                          </Button>
                        </td>
                      </tr>

                      {expandedLogId === job.id && (
                        <tr className="bg-muted/40">
                          <td colSpan={6} className="p-4">
                            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800 space-y-1">
                              <div className="text-slate-400 font-bold pb-1 border-b border-slate-800">
                                Job Execution Diagnostic Trace (Job ID: {job.id})
                              </div>
                              <div className="text-slate-300">
                                Result: {job.verificationDetails || 'No verification message recorded.'}
                              </div>
                              {job.executionOutput && (
                                <pre className="whitespace-pre-wrap text-slate-400 mt-2">{job.executionOutput}</pre>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
