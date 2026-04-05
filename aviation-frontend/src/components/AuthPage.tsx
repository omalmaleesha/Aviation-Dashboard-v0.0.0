import { useMemo, useState } from 'react';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { loginUser, registerUser } from '../auth/api';
import type { AuthSuccessResponse } from '../types/auth';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  onAuthenticated: (session: AuthSuccessResponse) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(
    () => (mode === 'login' ? 'Sign in to SkyOps Sentinel' : 'Create your SkyOps account'),
    [mode],
  );

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Use your credentials to access protected dashboards and APIs.'
        : 'Register a new operator account and start using protected APIs.',
    [mode],
  );

  const submitLabel = mode === 'login' ? 'Sign in' : 'Create account';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = { email: normalizedEmail, password };
      const session = mode === 'login' ? await loginUser(payload) : await registerUser(payload);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-aviation-blue/15 border border-aviation-blue/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-aviation-blue" />
          </div>
          <div>
            <h1 className="text-white text-base font-semibold tracking-tight">{title}</h1>
            <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5 rounded-lg bg-slate-800/60 p-1 border border-slate-700/70">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition ${
              mode === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition ${
              mode === 'register' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-aviation-blue"
              placeholder="newuser@example.com"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Password</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-aviation-blue"
              placeholder="StrongPass#2026"
              required
            />
          </label>

          {mode === 'register' && (
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-aviation-blue"
                placeholder="Re-enter your password"
                required
              />
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-aviation-blue text-slate-950 font-semibold py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-aviation-blue/90 transition"
          >
            {isSubmitting ? 'Please wait…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
