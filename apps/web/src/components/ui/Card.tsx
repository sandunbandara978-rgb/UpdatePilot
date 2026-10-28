import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] bg-white/85 dark:bg-[#161617]/85 backdrop-blur-xl text-card-foreground shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.06)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-5 sm:p-6 border-b border-black/[0.04] dark:border-white/[0.06]', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base sm:text-lg font-semibold leading-tight tracking-tight text-neutral-900 dark:text-neutral-100', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center p-5 sm:p-6 pt-0 border-t border-black/[0.04] dark:border-white/[0.06]', className)} {...props}>
      {children}
    </div>
  );
}
