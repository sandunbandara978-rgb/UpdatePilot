'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop, ShieldCheck, Eye, EyeOff, Lock, Mail, Copy, Check, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@updatepilot.local');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(true); // show password by default as requested!
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopiedUser, setIsCopiedUser] = useState(false);
  const [isCopiedPass, setIsCopiedPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        // Save user session in localStorage as well
        localStorage.setItem('updatepilot_user', JSON.stringify(data.data.user));
        // Redirect to dashboard
        router.push('/');
        router.refresh();
      } else {
        setError(data.error?.message || 'Invalid credentials. Please verify and try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error during login');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillDemo = () => {
    setEmail('admin@updatepilot.local');
    setPassword('Password123!');
    setError(null);
  };

  const copyText = (text: string, type: 'user' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'user') {
      setIsCopiedUser(true);
      setTimeout(() => setIsCopiedUser(false), 2000);
    } else {
      setIsCopiedPass(true);
      setTimeout(() => setIsCopiedPass(false), 2000);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/20 mb-2">
            <Laptop className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            UpdatePilot Platform
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Software Update Intelligence & Security Management for Windows Hosts
          </p>
        </div>

        {/* Demo Credentials Callout Box */}
        <div className="p-4 rounded-xl bg-card border-2 border-brand-500/30 shadow-lg shadow-brand-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Default Access Credentials</span>
            </div>
            <button
              type="button"
              onClick={autofillDemo}
              className="text-[11px] font-semibold text-brand-500 hover:text-brand-600 underline"
            >
              One-Click Autofill
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            {/* Username/Email */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border/60">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Username / Email:</span>
                <span className="font-mono font-bold text-foreground">admin@updatepilot.local</span>
              </div>
              <button
                type="button"
                onClick={() => copyText('admin@updatepilot.local', 'user')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy username"
              >
                {isCopiedUser ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border/60">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Password:</span>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">Password123!</span>
              </div>
              <button
                type="button"
                onClick={() => copyText('Password123!', 'pass')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy password"
              >
                {isCopiedPass ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Main Login Form Card */}
        <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xl space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username/Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Username or Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@updatepilot.local"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            {/* Password Input with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showPassword ? 'Hide password' : 'Show password'}</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password123!"
                  className="w-full pl-9 pr-10 py-2 rounded-lg bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span>Remember this workstation</span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full gap-2 text-sm font-bold shadow-md shadow-brand-500/20"
            >
              <span>Sign In to UpdatePilot</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Protected by Host DPAPI & HMAC Authentication</span>
        </div>
      </div>
    </div>
  );
}
