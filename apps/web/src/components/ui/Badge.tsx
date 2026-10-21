import React from 'react';
import { cn } from '@/lib/utils';
import { ApplicationStatus, JobStatus, DeviceStatus } from '@updatepilot/shared';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: ApplicationStatus | JobStatus | DeviceStatus | 'INFO' | 'WARNING' | 'DEFAULT';
}

export function Badge({ status = 'DEFAULT', className, children, ...props }: BadgeProps) {
  const getStyles = () => {
    switch (status) {
      case 'UP_TO_DATE':
      case 'ONLINE':
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'UPDATE_AVAILABLE':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'RUNNING':
      case 'VERIFYING':
      case 'CLAIMED':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse';
      case 'QUEUED':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      case 'RESTART_REQUIRED':
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'FAILED':
      case 'CANCELLED':
      case 'INTERRUPTED':
      case 'REVOKED':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'UNSUPPORTED':
      case 'UNMATCHED':
      case 'UNKNOWN_VERSION':
      case 'OFFLINE':
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'UP_TO_DATE':
        return 'Up to date';
      case 'UPDATE_AVAILABLE':
        return 'Update Available';
      case 'UNKNOWN_VERSION':
        return 'Unknown Version';
      case 'UNSUPPORTED':
        return 'Unsupported';
      case 'UNMATCHED':
        return 'Unmatched';
      case 'RESTART_REQUIRED':
        return 'Restart Required';
      default:
        return children || status;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border tracking-wide select-none',
        getStyles(),
        className
      )}
      {...props}
    >
      {children || getLabel()}
    </span>
  );
}
