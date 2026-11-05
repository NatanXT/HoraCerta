import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'E-mail ou senha inválidos.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[var(--hc-surface)] backdrop-blur-md border border-[var(--hc-border)] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] mb-4 border border-[var(--hc-accent-border)]">
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--hc-text)]">HoraCerta</h1>
          <p className="text-sm text-[var(--hc-text-secondary)] mt-1">Acesse sua conta para continuar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-rose-500 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider mb-2">
              E-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--hc-text-muted)]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-11 pr-4 py-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[var(--hc-text-secondary)] uppercase tracking-wider">
                Senha
              </label>
              <Link
                to="/esqueci-senha"
                className="text-xs text-[var(--hc-accent)] hover:opacity-85 font-medium transition-colors"
              >
                Esqueceu sua senha?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--hc-text-muted)]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl text-[var(--hc-text)] placeholder-[var(--hc-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 disabled:opacity-50 text-[var(--hc-accent-foreground)] font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-[var(--hc-border)]">
          <p className="text-sm text-[var(--hc-text-secondary)]">
            Ainda não tem conta?{' '}
            <Link
              to="/cadastro"
              className="text-[var(--hc-accent)] hover:opacity-85 font-medium transition-colors"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
