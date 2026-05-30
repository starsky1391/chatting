"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/useChatStore';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useChatStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resettingPassword, setResettingPassword] = useState(false);

  interface LoginResponse {
    user: {
      id: number;
      username: string;
      email: string;
      avatar: string;
      avatarUrl?: string;
      isOnline: boolean;
      role: 'admin' | 'moderator' | 'member';
      bio?: string;
    };
    accessToken: string;
  }

  interface EmailCodeResponse {
    cooldownSeconds: number;
  }

  const isResetEmailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim());
  const canResetPassword =
    isResetEmailReady &&
    resetCode.length === 6 &&
    resetPassword.length >= 6 &&
    resetPassword === resetConfirmPassword &&
    !resettingPassword;

  useEffect(() => {
    if (resetCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResetCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resetCooldown]);

  const openResetModal = () => {
    setResetOpen(true);
    setResetEmail(email);
    setResetCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setResetError('');
    setResetNotice('');
  };

  const closeResetModal = () => {
    if (sendingResetCode || resettingPassword) {
      return;
    }
    setResetOpen(false);
  };

  const handleSendResetCode = async () => {
    if (!isResetEmailReady || sendingResetCode || resetCooldown > 0) {
      return;
    }

    setResetError('');
    setResetNotice('');
    setSendingResetCode(true);

    try {
      const data = await api.post<EmailCodeResponse>('/api/auth/password-reset-code', { email: resetEmail });
      setResetNotice('Verification code sent. Check your inbox.');
      setResetCooldown(data.cooldownSeconds || 60);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setSendingResetCode(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetNotice('');

    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResettingPassword(true);

    try {
      await api.post('/api/auth/reset-password', {
        email: resetEmail,
        verificationCode: resetCode,
        password: resetPassword,
        confirmPassword: resetConfirmPassword,
      });
      setEmail(resetEmail);
      setPassword('');
      setResetNotice('Password updated. Sign in with your new password.');
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      window.setTimeout(() => setResetOpen(false), 900);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post<LoginResponse>('/api/auth/login', { email, password });
      login(data.user, data.accessToken);

      // Get redirect from URL params directly (in case state wasn't set)
      const redirect = searchParams.get('redirect');
      if (redirect) {
        router.push(redirect);
      } else if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push(`/${data.user.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f12] via-[#1a1a2e] to-[#16213e]">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div className="glass rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-bg mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold gradient-text">Chat App</h1>
            <p className="text-zinc-400 mt-2">Welcome back! Please sign in.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-fade-in">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-2.92a.75.75 0 10-1.5 0v1.5a.75.75 0 001.5 0v-1.5z" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-medium text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openResetModal}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 btn-primary rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#11131b] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Reset password</h2>
                <p className="mt-1 text-sm text-zinc-400">Use the email code to set a new password.</p>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                aria-label="Close reset password modal"
              >
                X
              </button>
            </div>

            {resetError && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {resetError}
              </div>
            )}

            {resetNotice && (
              <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {resetNotice}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="resetEmail" className="mb-2 block text-sm font-medium text-zinc-300">
                  Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    id="resetEmail"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="your@email.com"
                  />
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={!isResetEmailReady || sendingResetCode || resetCooldown > 0}
                    className="shrink-0 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-4 py-3 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingResetCode ? 'Sending' : resetCooldown > 0 ? `${resetCooldown}s` : 'Send code'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="resetCode" className="mb-2 block text-sm font-medium text-zinc-300">
                  Verification code
                </label>
                <input
                  type="text"
                  id="resetCode"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="6-digit code"
                />
              </div>

              <div>
                <label htmlFor="resetPassword" className="mb-2 block text-sm font-medium text-zinc-300">
                  New password
                </label>
                <input
                  type="password"
                  id="resetPassword"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Create a new password"
                />
              </div>

              <div>
                <label htmlFor="resetConfirmPassword" className="mb-2 block text-sm font-medium text-zinc-300">
                  Repeat password
                </label>
                <input
                  type="password"
                  id="resetConfirmPassword"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Repeat the new password"
                />
              </div>

              <button
                type="submit"
                disabled={!canResetPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f0f12] via-[#1a1a2e] to-[#16213e]">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
