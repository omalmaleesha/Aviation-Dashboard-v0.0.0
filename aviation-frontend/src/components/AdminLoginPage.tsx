import { useState } from 'react';
import { ShieldCheck, UserCog } from 'lucide-react';
import { adminLoginUser } from '../auth/api';
import type { AuthSuccessResponse } from '../types/auth';

interface AdminLoginPageProps {
  onAuthenticated: (session: AuthSuccessResponse) => void;
  onSwitchToUserLogin: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminLoginPage({ onAuthenticated, onSwitchToUserLogin }: AdminLoginPageProps) {
  const [email, setEmail] = useState('admin.test@skyops.com');
  const [password, setPassword] = useState('Admin#2026!Secure');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setIsSubmitting(true);

    try {
      const session = await adminLoginUser({ email: normalizedEmail, password });
      if (!session.user?.is_admin) {
        setError('This account does not have admin access.');
        return;
      }
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-slate-900/70 backdrop-blur p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <h1 className="text-white text-base font-semibold tracking-tight">Admin Control Access</h1>
            <p className="text-slate-400 text-xs mt-0.5">Secure login for SkyOps administrative operations.</p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-mono text-red-200">
          Use admin credentials only. All actions are audited.
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Admin email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-red-300"
              placeholder="admin.test@skyops.com"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-red-300"
              placeholder="Admin#2026!Secure"
              required
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-red-400 text-slate-950 font-semibold py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-300 transition inline-flex items-center justify-center gap-2"
          >
            <UserCog className="w-4 h-4" />
            {isSubmitting ? 'Verifying…' : 'Admin login'}
          </button>

          <button
            type="button"
            onClick={onSwitchToUserLogin}
            className="w-full rounded-lg border border-slate-700 text-slate-300 font-semibold py-2.5 text-sm hover:bg-slate-800/60 transition"
          >
            Back to user login
          </button>
        </form>
      </div>
    </div>
  );
}
