'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApplicationDetailModal } from '@/components/features/ApplicationDetailModal';
import { UpdatePreviewModal } from '@/components/features/UpdatePreviewModal';
import { ConnectAgentModal } from '@/components/features/ConnectAgentModal';
import { useDeviceContext } from '@/components/layout/DeviceContext';
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
  Laptop,
} from 'lucide-react';

export default function ApplicationsPage() {
  const { devices, selectedDeviceId, setSelectedDeviceId } = useDeviceContext();
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

  // Map device IDs to readable names
  const deviceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of devices) {
      map[d.id] = d.deviceName;
    }
    return map;
  }, [devices]);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        sortBy,
        sortOrder,
        ...(selectedDeviceId !== 'ALL' ? { deviceId: selectedDeviceId } : {}),
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
  }, [page, search, statusFilter, sortBy, sortOrder, selectedDeviceId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const exportUrl = `/api/v1/history/export?type=applications${
    selectedDeviceId !== 'ALL' ? `&deviceId=${selectedDeviceId}` : ''
  }`;

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
              Discovered installed software, version manifests, and trusted update sources across your fleet.
            </p>
          </div>
          <a href={exportUrl} download="updatepilot-applications.csv">
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

            {/* Filter by Computer */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Laptop className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg bg-background border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer font-semibold"
              >
                <option value="ALL">All Computers ({devices.length})</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.deviceName}
                  </option>
                ))}
              </select>
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
                className="px-3 py-2 rounded-lg bg-background border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="UPDATE_AVAILABLE">Update Available</option>
                <option value="UP_TO_DATE">Up to Date</option>
                <option value="UNMATCHED">Unmatched</option>
                <option value="UNSUPPORTED">Unsupported</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="name">Software Name</option>
                <option value="installedVersion">Installed Version</option>
                <option value="status">Status</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-9 px-2.5 text-xs font-semibold"
              >
                {sortOrder.toUpperCase()}
              </Button>
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
                  <th className="py-3.5 px-4">Computer</th>
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
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
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
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-medium text-[11px] truncate max-w-[150px]" title={deviceMap[app.deviceId] || app.deviceId}>
                          <Laptop className="h-3 w-3 text-brand-500 flex-shrink-0" />
                          <span className="truncate">{deviceMap[app.deviceId] || 'This Host'}</span>
                          {(deviceMap[app.deviceId]?.includes('Fixture') || app.deviceId === 'dev_win11_workstation_fixture') && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                              Demo
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[180px] block" title={app.packageId || 'Unmatched'}>
                          {app.packageId || '(unmatched)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground truncate max-w-[140px]" title={app.publisher || 'Unknown'}>
                        {app.publisher || 'â€”'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-foreground font-medium">
                        {app.installedVersion}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {app.availableVersion ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{app.availableVersion}</span>
                        ) : (
                          <span className="text-muted-foreground">â€”</span>
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
              <span className="font-semibold text-foreground">{total}</span> total applications
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="h-8 px-3"
              >
                Previous
              </Button>
              <span className="text-xs font-semibold px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="h-8 px-3"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        isOpen={Boolean(selectedAppId)}
        applicationId={selectedAppId}
        onClose={() => setSelectedAppId(null)}
      />

      {/* Update Preview & Confirmation Gate Modal */}
      <UpdatePreviewModal
        isOpen={Boolean(appToUpdate)}
        application={appToUpdate}
        onClose={() => setAppToUpdate(null)}
        onUpdateCompleted={() => {
          setAppToUpdate(null);
          fetchApplications();
        }}
      />

      <ConnectAgentModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onPairedSuccess={fetchApplications}
      />
    </div>
  );
}
