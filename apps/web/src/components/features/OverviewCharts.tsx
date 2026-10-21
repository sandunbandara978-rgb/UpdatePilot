'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { DashboardMetrics } from '@updatepilot/shared';
import { PieChart as PieIcon, BarChart3, ShieldCheck } from 'lucide-react';

interface OverviewChartsProps {
  metrics: DashboardMetrics | null;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'Up to Date': '#10b981', // emerald-500
  'Update Available': '#3b82f6', // blue-500
  'Unsupported / Custom': '#64748b', // slate-500
  'Unknown Version': '#f59e0b', // amber-500
};

export function OverviewCharts({ metrics, isLoading = false }: OverviewChartsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-80 flex items-center justify-center animate-pulse">
          <div className="text-xs text-muted-foreground">Loading chart data...</div>
        </Card>
        <Card className="h-80 flex items-center justify-center animate-pulse">
          <div className="text-xs text-muted-foreground">Loading chart data...</div>
        </Card>
      </div>
    );
  }

  // 1. Donut Chart Data: Software Status Distribution
  const total = metrics.totalApplications || 0;
  const pieData = [
    { name: 'Up to Date', value: metrics.upToDate || 0, color: STATUS_COLORS['Up to Date'] },
    { name: 'Update Available', value: metrics.updatesAvailable || 0, color: STATUS_COLORS['Update Available'] },
    { name: 'Unsupported / Custom', value: metrics.unsupported || 0, color: STATUS_COLORS['Unsupported / Custom'] },
    { name: 'Unknown Version', value: metrics.unknown || 0, color: STATUS_COLORS['Unknown Version'] },
  ].filter((item) => item.value > 0);

  // If no items, show default placeholder
  const displayPieData = pieData.length > 0 ? pieData : [{ name: 'No Applications', value: 1, color: '#94a3b8' }];

  // 2. Bar Chart Data: Software Ecosystem Overview
  const barData = [
    {
      category: 'Installed',
      'Total Apps': metrics.totalApplications || 0,
      'Verified Catalog': (metrics.upToDate || 0) + (metrics.updatesAvailable || 0),
    },
    {
      category: 'Compliance',
      'Total Apps': metrics.upToDate || 0,
      'Verified Catalog': metrics.upToDate || 0,
    },
    {
      category: 'Action Needed',
      'Total Apps': metrics.updatesAvailable || 0,
      'Verified Catalog': metrics.updatesAvailable || 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Software Status Distribution Donut Chart */}
      <Card className="hover:border-border/80 transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-brand-500" />
              Software Health Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Breakdown of {total} discovered applications on your Windows host.
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            {metrics.totalApplications > 0
              ? `${Math.round(((metrics.upToDate || 0) / metrics.totalApplications) * 100)}% Patched`
              : '0% Patched'}
          </span>
        </CardHeader>

        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={800}
                >
                  {displayPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const pct = total > 0 ? Math.round(((Number(data.value) || 0) / total) * 100) : 0;
                      return (
                        <div className="rounded-lg border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-sm text-xs">
                          <p className="font-semibold text-foreground">{data.name}</p>
                          <p className="text-muted-foreground mt-0.5">
                            <span className="font-bold text-foreground">{data.value}</span> packages ({pct}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legend */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/40">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground truncate">{item.name}:</span>
                <span className="font-bold text-foreground ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. Platform Compliance & Catalog Metrics Bar Chart */}
      <Card className="hover:border-border/80 transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              Update Readiness & Catalog Coverage
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Packages verified against official WinGet and Microsoft Store repositories.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Trusted Sources</span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-sm text-xs">
                          <p className="font-semibold text-foreground mb-1">{label}</p>
                          {payload.map((p) => (
                            <p key={p.dataKey} className="text-muted-foreground flex justify-between gap-4">
                              <span>{p.name}:</span>
                              <span className="font-bold text-foreground">{p.value}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  iconSize={8}
                />
                <Bar
                  dataKey="Total Apps"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  animationDuration={800}
                />
                <Bar
                  dataKey="Verified Catalog"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground text-center">
            Zero telemetry tracking. All version queries resolved directly via local WinGet provider.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
