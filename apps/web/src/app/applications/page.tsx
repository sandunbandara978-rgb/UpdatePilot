'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApplicationDetailModal } from '@/components/features/ApplicationDetailModal';
import { UpdatePreviewModal } from '@/components/features/UpdatePreviewModal';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { ApplicationEntity, ApplicationStatus } from '@updatepilot/shared';
import { formatDate } from '@/lib/utils';
import {
  Search,
  Filter,
  ArrowUpDown,
  Layers,
  ArrowUpCircle,
  Eye,
  Download,
  CheckCircle2,
} from 'lucide-react';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [appToUpdate, setAppToUpdate] = useState<ApplicationEntity | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        sortBy,
        sortOrder,
        ...(search ? { search } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      });

      const res = await fetch(`/api/v1/applications?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setApps(data.data.items);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return (
    <div>
      <Navbar onConnectAgentClick={() => setIsConnectModalOpen(true)} />

      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header and Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Application Inventory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discovered installed software, version manifests, and trusted update sources.
            </p>
          </div>
          <a href="/api/v1/history/export?type=applications" download="updatepilot-applications.csv">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </Button>
          </a>
        </div>

        {/* Filter and Search Bar */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/80">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search software name, package ID, or publisher..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border/70 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 rounded-lg bg-background border border-border/70 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses ({total})</option>
                <option value="UPDATE_AVAILABLE">Update Available</option>
                <option value="UP_TO_DATE">Up to Date</option>
                <option value="UNKNOWN_VERSION">Unknown Version</option>
                <option value="UNSUPPORTED">Unsupported</option>
                <option value="UNMATCHED">Unmatched</option>
              </select>

              {/* Sort By */}
              <div className="flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="py-2 px-3 rounded-lg bg-background border border-border/70 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="publisher">Sort by Publisher</option>
                  <option value="installedVersion">Sort by Version</option>
                  <option value="status">Sort by Status</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-2"
                  title="Toggle Ascending/Descending"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Data Table */}
        <Card className="overflow-hidden border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Software Name</th>
                  <th className="py-3.5 px-4">Package ID</th>
                  <th className="py-3.5 px-4">Publisher</th>
                  <th className="py-3.5 px-4">Installed</th>
                  <th className="py-3.5 px-4">Available</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No applications matched your filter criteria.
                    </td>
                  </tr>
                ) : (
                  apps.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[200px]" title={app.name}>
                            {app.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[180px] block" title={app.packageId || 'Unmatched'}>
                          {app.packageId || '(unmatched)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground truncate max-w-[140px]" title={app.publisher || 'Unknown'}>
                        {app.publisher || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-foreground font-medium">
                        {app.installedVersion}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {app.availableVersion ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{app.availableVersion}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={app.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAppId(app.id)}
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </Button>
                          {app.status === 'UPDATE_AVAILABLE' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setAppToUpdate(app)}
                              className="h-7 px-2.5 text-[11px] gap-1 font-semibold"
                            >
                              <ArrowUpCircle className="h-3 w-3" />
                              <span>Update</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-4 border-t border-border/60 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{apps.length}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> applications
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ApplicationDetailModal
        isOpen={Boolean(selectedAppId)}
        onClose={() => setSelectedAppId(null)}
        applicationId={selectedAppId}
      />

      <UpdatePreviewModal
        isOpen={Boolean(appToUpdate)}
        onClose={() => setAppToUpdate(null)}
        application={appToUpdate}
        onUpdateCompleted={fetchApplications}
      />

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={fetchApplications}
      />
    </div>
  );
}
