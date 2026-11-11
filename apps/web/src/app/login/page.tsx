'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Laptop,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Copy,
  Check,
  ArrowRight,
  KeyRound,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SHOW_DEV_CREDENTIALS =
  process.env.NEXT_PUBLIC_HIDE_DEMO_CREDENTIALS !== 'true';

const DEFAULT_ACCOUNT = {
  id: 'usr_default_admin',
  name: 'Local Administrator',
  role: 'ADMIN',
  username: 'admin',
  email: 'admin@updatepilot.local',
  password: 'Password123!',
};

interface RememberedAccount {
  id?: string;
  name?: string;
  email: string;
  role?: string;
}

export default function LoginPage() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(SHOW_DEV_CREDENTIALS ? DEFAULT_ACCOUNT.email : '');
  const [password, setPassword] = useState(SHOW_DEV_CREDENTIALS ? DEFAULT_ACCOUNT.password : '');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);
  const [isCopiedUser, setIsCopiedUser] = useState(false);
  const [isCopiedPass, setIsCopiedPass] = useState(false);
  const [isAutofilled, setIsAutofilled] = useState(SHOW_DEV_CREDENTIALS);
  const [rememberedUser, setRememberedUser] = useState<RememberedAccount | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('updatepilot_user');
      if (raw) {
        const parsed = JSON.parse(raw) as RememberedAccount;
        if (parsed && parsed.email) {
          setRememberedUser(parsed);
        }
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  const authenticate = async (
    authMode: 'login' | 'register',
    targetEmail: string,
    targetPassword: string,
    targetName?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const payload =
        authMode === 'login'
          ? { email: targetEmail.trim(), password: targetPassword }
          : { name: (targetName || '').trim(), email: targetEmail.trim(), password: targetPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: { success?: boolean; data?: { user?: unknown }; error?: { message?: string } } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        setError(`Server returned an unexpected response (HTTP ${res.status}).`);
        return;
      }

      if (res.ok && data.success && data.data?.user) {
        if (rememberMe) {
          localStorage.setItem('updatepilot_user', JSON.stringify(data.data.user));
        } else {
          localStorage.removeItem('updatepilot_user');
        }
        window.location.assign('/');
      } else {
        setError(data.error?.message || `Authentication failed (HTTP ${res.status}). Please check your details.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read DOM ref fallback in case browser password manager populated fields without triggering onChange
    const effectiveEmail = (email || emailInputRef.current?.value || '').trim();
    const effectivePassword = password || passwordInputRef.current?.value || '';
    if (!effectiveEmail || !effectivePassword) {
      setError('Please enter both your email/username and password.');
      return;
    }
    await authenticate(mode, effectiveEmail, effectivePassword, name);
  };

  const autofillDemo = () => {
    setMode('login');
    setEmail(DEFAULT_ACCOUNT.email);
    setPassword(DEFAULT_ACCOUNT.password);
    if (emailInputRef.current) emailInputRef.current.value = DEFAULT_ACCOUNT.email;
    if (passwordInputRef.current) passwordInputRef.current.value = DEFAULT_ACCOUNT.password;
    setError(null);
    setIsAutofilled(true);
    setAutofillNotice('Admin login details filled into the form below.');
    setTimeout(() => setAutofillNotice(null), 3000);
  };

  const autofillAndSignIn = async () => {
    setMode('login');
    setEmail(DEFAULT_ACCOUNT.email);
    setPassword(DEFAULT_ACCOUNT.password);
    if (emailInputRef.current) emailInputRef.current.value = DEFAULT_ACCOUNT.email;
    if (passwordInputRef.current) passwordInputRef.current.value = DEFAULT_ACCOUNT.password;
    setIsAutofilled(true);
    await authenticate('login', DEFAULT_ACCOUNT.email, DEFAULT_ACCOUNT.password);
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-5 relative z-10 py-4">
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

        {/* Account Details & Login Details Callout */}
        {SHOW_DEV_CREDENTIALS && mode === 'login' && (
          <div className="p-4 rounded-xl bg-card border-2 border-brand-500/30 shadow-lg shadow-brand-500/5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                <KeyRound className="h-3.5 w-3.5" />
                <span>Account &amp; Login Details</span>
              </div>
              {isAutofilled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Check className="h-3 w-3" />
                  Autofilled
                </span>
              )}
            </div>

            {/* Account Metadata */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Account Name</span>
                <span className="font-semibold text-foreground">{DEFAULT_ACCOUNT.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Role &amp; Access</span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {DEFAULT_ACCOUNT.role}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Account ID</span>
                <span className="font-mono text-[11px] text-foreground">{DEFAULT_ACCOUNT.id}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Username Alias</span>
                <span className="font-mono text-[11px] text-foreground">{DEFAULT_ACCOUNT.username}</span>
              </div>
            </div>

            {/* Login Credentials */}
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border/60">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Login Email / Username:</span>
                  <span className="font-mono font-bold text-foreground">{DEFAULT_ACCOUNT.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(DEFAULT_ACCOUNT.email, 'user')}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copy email"
                >
                  {isCopiedUser ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border/60">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Login Password:</span>
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{DEFAULT_ACCOUNT.password}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(DEFAULT_ACCOUNT.password, 'pass')}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copy password"
                >
                  {isCopiedPass ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Auto-Fill Controls */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autofillDemo}
                className="gap-1.5 text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                <span>Auto Fill</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isLoading}
                onClick={autofillAndSignIn}
                className="gap-1.5 text-xs font-semibold"
              >
                <span>Auto Fill &amp; Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {rememberedUser && rememberedUser.email.toLowerCase() !== DEFAULT_ACCOUNT.email && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground truncate">
                  Last user: <strong className="text-foreground">{rememberedUser.name || rememberedUser.email}</strong> ({rememberedUser.email})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(rememberedUser.email);
                    setPassword('');
                    setIsAutofilled(false);
                    setError(null);
                  }}
                  className="font-semibold text-brand-500 hover:text-brand-600 shrink-0 ml-2 underline"
                >
                  Use Email
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Login / Register Card */}
        <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-xl space-y-5">
          {/* Mode Toggle */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          {autofillNotice && !error && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{autofillNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="login-name" className="text-xs font-semibold text-foreground block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    id="login-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-foreground block">
                {mode === 'login' ? 'Username or Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  ref={emailInputRef}
                  id="login-email"
                  name={mode === 'login' ? 'username' : 'email'}
                  type={mode === 'register' ? 'email' : 'text'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsAutofilled(false);
                  }}
                  placeholder="admin@updatepilot.local"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-foreground block">Password</label>
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
                  ref={passwordInputRef}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setIsAutofilled(false);
                  }}
                  placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter password'}
                  className="w-full pl-9 pr-10 py-2 rounded-lg bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full gap-2 text-sm font-bold shadow-md shadow-brand-500/20"
            >
              <span>{mode === 'login' ? 'Sign In to UpdatePilot' : 'Create Account & Continue'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Protected by PBKDF2-SHA512 & HMAC Session Authentication</span>
        </div>
      </div>
    </div>
  );
}
